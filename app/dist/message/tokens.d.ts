/**
 * Token estimation - To be implemented in Phase 21
 * Based on Python message_adapter.py:111-117 (estimate_tokens)
 */
export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
export declare class TokenEstimator {
    static estimateTokens(text: string): number;
    static calculateUsage(prompt: string, completion: string): TokenUsage;
}
//# sourceMappingURL=tokens.d.ts.map