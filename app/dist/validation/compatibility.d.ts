/**
 * Compatibility reporting - To be implemented in Phase 27
 * Based on Python compatibility endpoint logic
 */
export interface CompatibilityReport {
    supported_parameters: string[];
    unsupported_parameters: string[];
    warnings: string[];
    suggestions: string[];
}
export declare class CompatibilityReporter {
    static analyzeRequest(_request: any): CompatibilityReport;
    static getClaudeSDKOptions(): Record<string, any>;
}
//# sourceMappingURL=compatibility.d.ts.map