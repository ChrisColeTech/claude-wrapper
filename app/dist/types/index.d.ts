/**
 * Core type definitions
 * Based on Python models.py structures
 */
/// <reference types="node" />
export interface ApiResponse<T = any> {
    data?: T;
    error?: {
        message: string;
        type: string;
        code: string;
    };
}
export interface RequestWithAuth extends Request {
    user?: {
        apiKey: string;
    };
}
//# sourceMappingURL=index.d.ts.map