"use strict";
/**
 * Token estimation - To be implemented in Phase 21
 * Based on Python message_adapter.py:111-117 (estimate_tokens)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenEstimator = void 0;
class TokenEstimator {
    static estimateTokens(text) {
        // Implementation pending - Phase 21
        // Character-based estimation matching Python
        return Math.ceil(text.length / 4);
    }
    static calculateUsage(prompt, completion) {
        // Implementation pending - Phase 21
        const prompt_tokens = this.estimateTokens(prompt);
        const completion_tokens = this.estimateTokens(completion);
        return {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens + completion_tokens
        };
    }
}
exports.TokenEstimator = TokenEstimator;
//# sourceMappingURL=tokens.js.map