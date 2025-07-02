/**
 * Message adapter - To be implemented in Phase 19
 * Based on Python message_adapter.py:9-34 (messages_to_prompt)
 */
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    name?: string;
}
export declare class MessageAdapter {
    static convertToClaudeFormat(_messages: Message[]): string;
    static extractSystemPrompt(_messages: Message[]): string | null;
}
//# sourceMappingURL=adapter.d.ts.map