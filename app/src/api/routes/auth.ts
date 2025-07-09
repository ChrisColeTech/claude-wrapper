/**
 * Authentication Status Routes
 * Provides information about authentication configuration
 */

import { Router, Request, Response } from 'express';
import { getApiKey, isApiKeyProtectionEnabled } from '../../auth/middleware';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @swagger
 * /v1/auth/status:
 *   get:
 *     summary: Check authentication configuration and status
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Authentication status information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authentication:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                       description: Whether API key protection is enabled
 *                     type:
 *                       type: string
 *                       description: Authentication type (bearer_token or none)
 *                     protected_endpoints:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of protected endpoint patterns
 *                     public_endpoints:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of public endpoint patterns
 */
router.get('/v1/auth/status', (req: Request, res: Response) => {
  try {
    const isProtected = isApiKeyProtectionEnabled();
    const apiKey = getApiKey();
    
    logger.info('Authentication status requested', {
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    const response = {
      authentication: {
        enabled: isProtected,
        type: isProtected ? 'bearer_token' : 'none',
        protected_endpoints: isProtected ? [
          '/v1/chat/completions',
          '/v1/sessions/*',
          '/v1/models'
        ] : [],
        public_endpoints: [
          '/health',
          '/docs',
          '/swagger.json',
          '/v1/auth/status'
        ],
        ...(isProtected && {
          api_key_configured: !!apiKey,
          api_key_length: apiKey ? apiKey.length : 0
        })
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Error checking authentication status', error as Error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_error',
        code: 'auth_status_error'
      }
    });
  }
});

export default router;