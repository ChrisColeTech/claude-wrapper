/**
 * Custom header processing - To be implemented in Phase 27
 * Based on Python parameter_validator.py:96-137 extract_claude_headers
 */
export interface ClaudeHeaders {
    maxTurns?: number;
    allowedTools?: string[];
    disallowedTools?: string[];
    permissionMode?: string;
    maxThinkingTokens?: number;
}
export declare class HeaderProcessor {
    static extractClaudeHeaders(_headers: Record<string, string>): ClaudeHeaders;
    static validateHeaders(_headers: ClaudeHeaders): ValidationResult;
}
interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export {};
//# sourceMappingURL=headers.d.ts.map