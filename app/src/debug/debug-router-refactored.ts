/**
 * Debug Router (Phase 14B - Refactored)
 * Single Responsibility: Main orchestrator for debug endpoints
 * 
 * Replaces oversized debug-router.ts following SRP and DRY principles
 * Coordinates focused route handlers under 200 lines total
 */

import { Router } from 'express';
import { DebugRouteConfig, DebugRouterConfig } from './routing/debug-route-config';
import { getLogger } from '../utils/logger';

const logger = getLogger('DebugRouter');

/**
 * Main debug router that orchestrates all debug functionality
 * SRP: Route coordination and configuration only
 */
export class DebugRouter {
  private routeConfig: DebugRouteConfig;
  private router: Router;

  constructor(config?: Partial<DebugRouterConfig>) {
    this.routeConfig = new DebugRouteConfig(config);
    this.router = this.routeConfig.createRouter();
    
    logger.info('Debug router initialized', { 
      config,
      message: 'All debug endpoints configured and ready'
    });
  }

  /**
   * Get the configured Express router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get route configuration
   */
  getConfig(): DebugRouteConfig {
    return this.routeConfig;
  }
}

/**
 * Create debug router with default configuration
 */
export function createDebugRouter(config?: Partial<DebugRouterConfig>): Router {
  const debugRouter = new DebugRouter(config);
  return debugRouter.getRouter();
}

/**
 * Export default router instance for convenience
 */
export const debugRouter = createDebugRouter();

// Export all focused components for direct access if needed
export { DebugRouteConfig } from './routing/debug-route-config';
export { DebugRequestValidator } from './routing/debug-request-validator';
export { ToolInspectionHandlers } from './handlers/tool-inspection-handlers';
export { CompatibilityHandlers } from './handlers/compatibility-handlers';
export { DebugResponseUtils } from './utils/debug-response-utils';