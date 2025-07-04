"use strict";
/**
 * Claude SDK Service Interfaces
 * Based on CLAUDE_SDK_REFERENCE.md patterns and Python claude_cli.py
 *
 * Single Responsibility: Define clean interfaces for Claude SDK integration
 */
exports.__esModule = true;
exports.CLAUDE_SDK_CONSTANTS = void 0;
/**
 * Claude SDK Constants
 * Based on CLAUDE_SDK_REFERENCE.md constants
 */
exports.CLAUDE_SDK_CONSTANTS = {
    /** Default timeout */
    DEFAULT_TIMEOUT: 600000,
    /** Default model */
    DEFAULT_MODEL: 'claude-3-5-sonnet-20241022',
    /** Default max turns */
    DEFAULT_MAX_TURNS: 1,
    /** Performance requirement */
    PERFORMANCE_REQUIREMENT_MS: 2000,
    /** Authentication methods */
    AUTH_METHODS: {
        ANTHROPIC_API_KEY: 'anthropic',
        BEDROCK: 'bedrock',
        VERTEX: 'vertex',
        CLAUDE_CLI: 'claude-cli'
    },
    /** SDK timeouts */
    SDK_TIMEOUTS: {
        VERIFICATION: 5000,
        COMPLETION: 600000,
        STREAMING: 30000 // 30 seconds
    }
};
