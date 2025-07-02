/**
 * Tool validation - To be implemented in Phase 26
 * Based on Python parameter_validator.py:96-137 tool header validation
 */
import { ClaudeCodeTool } from './constants';
export interface ToolValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class ToolValidator {
    static validateToolNames(_tools: string[]): ToolValidationResult;
    static validatePermissionMode(mode: string): boolean;
    static parseToolHeader(_headerValue: string): ClaudeCodeTool[];
}
//# sourceMappingURL=validator.d.ts.map