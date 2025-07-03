/**
 * Authentication initialization for server startup
 * Based on Python main.py lifespan authentication setup
 * 
 * Single Responsibility: Authentication system initialization
 */

import winston from 'winston';
import { authManager } from '../auth/auth-manager';

/**
 * Initialize authentication system
 * Detects and validates authentication methods
 * Matches Python main.py lifespan authentication logic
 * 
 * @param logger Winston logger instance
 */
export async function initializeAuthentication(logger: winston.Logger): Promise<void> {
  try {
    // Silent detection like Python - only log internally
    logger.debug('Initializing authentication system...');
    
    // Detect available authentication methods silently
    const authResult = await authManager.detectAuthMethod();
    
    if (authResult.valid) {
      console.log(`🔐 Claude authentication: ${authResult.method}`);
      logger.info(`Authentication method detected: ${authResult.method}`);
    } else {
      // Silent failure like Python - only show in debug logs
      logger.debug('No valid authentication method found. Server will run without Claude authentication.');
      logger.debug('Authentication errors:', authResult.errors);
      // Don't show error to user unless debug mode is enabled
      if (process.env.DEBUG_MODE === 'true') {
        console.log('⚠️  No Claude authentication found (running with limited functionality)');
      }
    }
    
  } catch (error) {
    logger.debug(`Authentication initialization failed: ${error}`);
    logger.debug('Server will continue without authentication');
  }
}