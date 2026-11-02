import type { z } from 'zod';

/** A function the model may ask us to call. `parameters` doubles as the schema we show the model and the check we run on its arguments. */
export interface AiTool<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: S;
  run(args: z.infer<S>): Promise<unknown>;
}

/** Infers the argument type of `run` from `parameters`, then erases it so tools fit in one array. */
export function defineTool<S extends z.ZodType>(tool: AiTool<S>): AiTool {
  return tool as unknown as AiTool;
}
