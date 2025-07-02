// Chat completion models - To be implemented in Phases 9-10
// Based on Python models.py:39-128
export interface ChatCompletionRequest {
  model: string;
  messages: any[];
  stream?: boolean;
}
