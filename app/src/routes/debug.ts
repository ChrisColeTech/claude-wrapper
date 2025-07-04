/**
 * Debug Router - Debug and Compatibility Endpoints
 * Phase 14A Implementation: Complete debug and compatibility endpoints
 * Based on Phase 14A requirements for tool call inspection and debugging
 * 
 * Single Responsibility: HTTP endpoint handling for debugging and compatibility analysis
 */

import { Router } from 'express';
import { debugRouter } from '../debug/debug-router';
import { getLogger } from '../utils/logger';

const logger = getLogger('DebugRouter');

/**
 * Debug Router class
 * Phase 14A implementation using new debug services
 */
export class DebugRouter {
  
  /**
   * Create Express router with debug endpoints
   * Uses the new Phase 14A debug-router implementation
   */
  static createRouter(): Router {
    const router = debugRouter.getRouter();
    logger.info('DebugRouter configured with Phase 14A debug services');
    return router;
  }
}

/**
 * Default export for backward compatibility
 */
export default DebugRouter.createRouter();