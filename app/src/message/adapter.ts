/**
 * Message adapter - To be implemented in Phase 19
 * Based on Python message_adapter.py:9-34 (messages_to_prompt)
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
}

export class MessageAdapter {
  static convertToClaudeFormat(_messages: Message[]): string {
    // Implementation pending - Phase 19
    return '';
  }
  
  static extractSystemPrompt(_messages: Message[]): string | null {
    // Implementation pending - Phase 19
    return null;
  }
}
