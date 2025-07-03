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
    logger.info('Initializing authentication system...');
    
    // Detect available authentication methods
    const authResult = await authManager.detectAuthMethod();
    
    if (authResult.valid) {
      logger.info(`Authentication method detected: ${authResult.method}`);
    } else {
      logger.warn('No valid authentication method found. Server will run without Claude authentication.');
      logger.debug('Authentication errors:', authResult.errors);
    }
    
    // Log API key protection status
    if (authManager.isProtected()) {
      logger.info('API key protection enabled - server endpoints will require authentication');
    } else {
      logger.info('API key protection disabled - server endpoints are open');
    }
    
  } catch (error) {
    logger.warn(`Authentication initialization failed: ${error}`);
    logger.info('Server will continue without authentication');
  }
}