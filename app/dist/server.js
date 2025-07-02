"use strict";
/**
 * Express server configuration
 * Based on Python main.py FastAPI app setup
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = require("./utils/logger");
const env_1 = require("./utils/env");
async function createApp() {
    const app = (0, express_1.default)();
    // Basic middleware
    app.use(express_1.default.json());
    app.use((0, cors_1.default)({
        origin: env_1.config.CORS_ORIGINS === '["*"]' ? true : JSON.parse(env_1.config.CORS_ORIGINS),
        credentials: true
    }));
    // Basic health check endpoint
    app.get('/health', (_req, res) => {
        res.json({
            status: 'healthy',
            service: 'claude-code-openai-wrapper'
        });
    });
    logger_1.logger.info('Express app configured successfully');
    return app;
}
exports.createApp = createApp;
//# sourceMappingURL=server.js.map