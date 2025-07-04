"use strict";
/**
 * Message compatibility checking utilities
 */
exports.__esModule = true;
exports.checkMessageCompatibility = void 0;
/**
 * Check message compatibility with OpenAI standards
 */
function checkMessageCompatibility(messages) {
    var issues = [];
    var score = 100;
    if (!Array.isArray(messages)) {
        score = 0;
        issues.push('Messages must be an array');
        return { score: score, issues: issues };
    }
    if (messages.length === 0) {
        score -= 50;
        issues.push('Messages array cannot be empty');
    }
    var validRoles = ['system', 'user', 'assistant', 'tool'];
    messages.forEach(function (message, index) {
        if (!message.role) {
            score -= 10;
            issues.push("Message ".concat(index, ": Missing required 'role' field"));
        }
        else if (!validRoles.includes(message.role)) {
            score -= 15;
            issues.push("Message ".concat(index, ": Invalid role '").concat(message.role, "'. Must be one of: ").concat(validRoles.join(', ')));
        }
        if (!message.content && message.role !== 'tool') {
            score -= 10;
            issues.push("Message ".concat(index, ": Missing required 'content' field"));
        }
        // Tool message specific checks
        if (message.role === 'tool') {
            if (!message.tool_call_id) {
                score -= 15;
                issues.push("Message ".concat(index, ": Tool messages must have 'tool_call_id' field"));
            }
            if (!message.content) {
                score -= 10;
                issues.push("Message ".concat(index, ": Tool messages must have 'content' field"));
            }
        }
        // Assistant message with tool calls checks
        if (message.role === 'assistant' && message.tool_calls) {
            if (!Array.isArray(message.tool_calls)) {
                score -= 15;
                issues.push("Message ".concat(index, ": tool_calls must be an array"));
            }
            else {
                message.tool_calls.forEach(function (toolCall, tcIndex) {
                    if (!toolCall.id) {
                        score -= 10;
                        issues.push("Message ".concat(index, ", tool_call ").concat(tcIndex, ": Missing 'id' field"));
                    }
                    if (!toolCall.type || toolCall.type !== 'function') {
                        score -= 10;
                        issues.push("Message ".concat(index, ", tool_call ").concat(tcIndex, ": Invalid or missing 'type' field (must be 'function')"));
                    }
                    if (!toolCall["function"] || !toolCall["function"].name) {
                        score -= 10;
                        issues.push("Message ".concat(index, ", tool_call ").concat(tcIndex, ": Missing function name"));
                    }
                });
            }
        }
    });
    return { score: Math.max(0, score), issues: issues };
}
exports.checkMessageCompatibility = checkMessageCompatibility;
