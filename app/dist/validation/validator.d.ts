/**
 * Parameter validator - To be implemented in Phase 27
 * Based on Python parameter_validator.py ParameterValidator class
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare class ParameterValidator {
    static validateRequest(_request: any): ValidationResult;
    static validateModel(_model: string): ValidationResult;
    static validateMessages(_messages: any[]): ValidationResult;
}
//# sourceMappingURL=validator.d.ts.map