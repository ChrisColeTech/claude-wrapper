"use strict";
/**
 * Claude Code OpenAI Wrapper - Server Logic
 * Main server functionality
 *
 * Based on Python implementation main.py
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const server_1 = require("./server");
const logger_1 = require("./utils/logger");
const env_1 = require("./utils/env");
// Load environment variables
dotenv_1.default.config();
async function startServer(options = {}) {
    try {
        // Apply CLI options to config
        const serverPort = options.port || env_1.config.PORT;
        logger_1.logger.info('Starting Claude Code OpenAI Wrapper...');
        const app = await (0, server_1.createApp)();
        app.listen(serverPort, () => {
            logger_1.logger.info(`Server running on http://localhost:${serverPort}`);
            logger_1.logger.info('Ready to process OpenAI-compatible requests');
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        throw error;
    }
}
exports.startServer = startServer;
// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});
// Direct execution (for npm run dev)
if (require.main === module) {
    startServer().catch((error) => {
        logger_1.logger.error('Unhandled error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map