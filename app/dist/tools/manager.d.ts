/**
 * Tool management - To be implemented in Phase 26
 * Based on Python tool control logic from models.py:53 and parameter_validator.py
 */
import { ClaudeCodeTool, PermissionMode } from './constants';
export interface ToolConfiguration {
    disable_tools?: boolean;
    allowed_tools?: ClaudeCodeTool[];
    disallowed_tools?: ClaudeCodeTool[];
    permission_mode?: PermissionMode;
    max_turns?: number;
}
export declare class ToolManager {
    static configureTools(config: ToolConfiguration): {
        allowed_tools?: ClaudeCodeTool[];
        disallowed_tools?: ClaudeCodeTool[];
        max_turns: number;
    };
}
//# sourceMappingURL=manager.d.ts.map