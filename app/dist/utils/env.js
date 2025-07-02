"use strict";
/**
 * Environment variable configuration
 * Based on Python main.py environment handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
function parseBoolean(value) {
    return ['true', '1', 'yes', 'on'].includes(value?.toLowerCase() || 'false');
}
exports.config = {
    DEBUG_MODE: parseBoolean(process.env.DEBUG_MODE),
    VERBOSE: parseBoolean(process.env.VERBOSE),
    PORT: parseInt(process.env.PORT || '8000', 10),
    CORS_ORIGINS: process.env.CORS_ORIGINS || '["*"]',
    MAX_TIMEOUT: parseInt(process.env.MAX_TIMEOUT || '600000', 10),
    API_KEY: process.env.API_KEY
};
//# sourceMappingURL=env.js.map