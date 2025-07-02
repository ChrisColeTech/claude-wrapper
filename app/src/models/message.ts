// Message models - To be implemented in Phase 7
// Based on Python models.py:16-36
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}
