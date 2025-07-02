/**
 * Message service - To be implemented in Phase 4
 * Business logic for message processing
 * Matches Python message_adapter.py approach exactly
 */
export declare class MessageService {
    processMessage(_message: any): Promise<any>;
    convertToClaudeFormat(_messages: any[]): Promise<string>;
    filterContent(content: string): Promise<string>;
}
//# sourceMappingURL=message-service.d.ts.map