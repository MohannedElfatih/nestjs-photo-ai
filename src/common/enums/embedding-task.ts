/** What an embedding will be used for. The values are the task types the Gemini embeddings API expects. */
export enum EmbeddingTask {
  /** Text that is stored and searched against. */
  Document = 'RETRIEVAL_DOCUMENT',
  /** Text a user searches with. */
  Query = 'RETRIEVAL_QUERY',
}
