import { BadGatewayException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { EmbeddingTask } from '../common/enums/embedding-task.js';
import { defineTool } from './ai-tool.js';
import { AiService } from './ai.service.js';
import { EMBEDDING_DIMENSIONS } from './embedding.constants.js';

// Replace the Gemini SDK with a fake client whose methods we control. vi.hoisted makes the
// mocks available inside the factory, which Vitest runs before the imports above.
const { generateContent, embedContent } = vi.hoisted(() => ({ generateContent: vi.fn(), embedContent: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent, embedContent };
  },
}));

const modelTurn = { role: 'model', parts: [{ functionCall: { name: 'getPhoto' } }] };
const callTool = (name: string, args: unknown) => ({
  functionCalls: [{ id: 'call-1', name, args }],
  candidates: [{ content: modelTurn }],
});
const finalAnswer = (text: string) => ({ functionCalls: undefined, text });

describe('AiService', () => {
  let service: AiService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const config = {
      getOrThrow: () => 'test-key',
      get: (_key: string, fallback?: string) => fallback,
    };
    service = new AiService(config as unknown as ConfigService);
  });

  describe('chatWithTools', () => {
    const getPhoto = vi.fn();
    const tools = [
      defineTool({
        name: 'getPhoto',
        description: 'Gets a photo by id',
        parameters: z.object({ id: z.number().int().positive() }),
        run: getPhoto,
      }),
    ];

    beforeEach(() => getPhoto.mockResolvedValue({ name: 'Beach' }));

    it('returns the answer straight away when the model calls no tools', async () => {
      generateContent.mockResolvedValueOnce(finalAnswer('Hello'));

      await expect(service.chatWithTools('hi', tools)).resolves.toEqual({ answer: 'Hello', toolCalls: [] });
      expect(getPhoto).not.toHaveBeenCalled();
    });

    it('runs the tool the model asked for and sends the result back', async () => {
      generateContent.mockResolvedValueOnce(callTool('getPhoto', { id: 2 })).mockResolvedValueOnce(finalAnswer('It is Beach'));

      const result = await service.chatWithTools('what is photo 2?', tools);

      expect(getPhoto).toHaveBeenCalledWith({ id: 2 });
      expect(result).toEqual({ answer: 'It is Beach', toolCalls: [{ name: 'getPhoto', args: { id: 2 } }] });

      // The second request carries the whole conversation: question, the model's turn, our answer.
      const secondRequest = generateContent.mock.calls[1][0];
      expect(secondRequest.contents).toHaveLength(3);
      expect(secondRequest.contents[2].parts[0].functionResponse).toMatchObject({
        id: 'call-1',
        name: 'getPhoto',
        response: { output: { name: 'Beach' } },
      });
    });

    it('treats the model\'s arguments as untrusted input: invalid ones never reach the tool', async () => {
      generateContent.mockResolvedValueOnce(callTool('getPhoto', { id: 'not a number' })).mockResolvedValueOnce(finalAnswer('ok'));

      await service.chatWithTools('hi', tools);

      expect(getPhoto).not.toHaveBeenCalled();
      const sent = generateContent.mock.calls[1][0].contents[2].parts[0].functionResponse.response;
      expect(sent.error).toMatch(/Invalid arguments/);
    });

    it('answers an unknown tool name with an error the model can read', async () => {
      generateContent.mockResolvedValueOnce(callTool('deleteEverything', {})).mockResolvedValueOnce(finalAnswer('ok'));

      await service.chatWithTools('hi', tools);

      const sent = generateContent.mock.calls[1][0].contents[2].parts[0].functionResponse.response;
      expect(sent).toEqual({ error: 'Unknown tool deleteEverything' });
    });

    it('reports a tool failure to the model without leaking the details', async () => {
      // A plain function, not a vi.fn: Vitest reports a spy that rejects as a failure of its own,
      // even when the code under test catches the error (which is exactly what we are testing).
      const failing = defineTool({
        name: 'getPhoto',
        description: 'Always fails',
        parameters: z.object({ id: z.number() }),
        run: async () => {
          throw new Error('connection string with password');
        },
      });
      generateContent.mockResolvedValueOnce(callTool('getPhoto', { id: 1 })).mockResolvedValueOnce(finalAnswer('ok'));

      await service.chatWithTools('hi', [failing]);

      const sent = generateContent.mock.calls[1][0].contents[2].parts[0].functionResponse.response;
      expect(sent).toEqual({ error: 'The tool failed' });
    });

    it('gives up with a bad gateway if the model never stops calling tools', async () => {
      generateContent.mockResolvedValue(callTool('getPhoto', { id: 1 }));

      await expect(service.chatWithTools('hi', tools, 3)).rejects.toBeInstanceOf(BadGatewayException);
      expect(generateContent).toHaveBeenCalledTimes(3);
    });

    it('turns a provider failure into a bad gateway', async () => {
      generateContent.mockRejectedValue(new Error('503 from Google'));

      await expect(service.chatWithTools('hi', tools)).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('embed', () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i / 1000);

    it('returns the vector and asks for the configured size and task type', async () => {
      embedContent.mockResolvedValue({ embeddings: [{ values: vector }] });

      await expect(service.embed('a cat', EmbeddingTask.Query)).resolves.toBe(vector);
      expect(embedContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: 'a cat',
          config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: EMBEDDING_DIMENSIONS },
        }),
      );
    });

    it('rejects a vector of the wrong size instead of storing something unusable', async () => {
      embedContent.mockResolvedValue({ embeddings: [{ values: [0.1, 0.2] }] });

      await expect(service.embed('a cat', EmbeddingTask.Document)).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('rejects an empty response', async () => {
      embedContent.mockResolvedValue({});

      await expect(service.embed('a cat', EmbeddingTask.Document)).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('describeImage', () => {
    it('validates the model output against the schema', async () => {
      generateContent.mockResolvedValueOnce({ text: JSON.stringify({ description: 'A cat', tags: ['cat'] }) });

      await expect(service.describeImage(Buffer.from('x'), 'image/jpeg')).resolves.toEqual({
        description: 'A cat',
        tags: ['cat'],
      });
    });

    it.each([
      ['malformed JSON', 'not json at all'],
      ['the wrong shape', JSON.stringify({ description: 'A cat' })],
      ['too many tags', JSON.stringify({ description: 'A cat', tags: Array(11).fill('x') })],
    ])('refuses output with %s', async (_name, text) => {
      generateContent.mockResolvedValueOnce({ text });

      await expect(service.describeImage(Buffer.from('x'), 'image/jpeg')).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
