import { Router, Request, Response } from 'express';
import { logger, LogLevel } from '../../utils/logger';

const router = Router();

/**
 * @swagger
 * /logs:
 *   get:
 *     summary: Get server logs
 *     description: Retrieve recent server logs with optional filtering
 *     tags:
 *       - System
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *         description: Filter logs by level
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of logs to return
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return logs since this timestamp (ISO 8601)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [request, response, general]
 *         description: Filter logs by type
 *     responses:
 *       200:
 *         description: Server logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       level:
 *                         type: string
 *                         enum: [error, warn, info, debug]
 *                       message:
 *                         type: string
 *                       context:
 *                         type: object
 *                       requestId:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [request, response, general]
 *                 total:
 *                   type: integer
 *                   description: Total number of logs returned
 *                 filters:
 *                   type: object
 *                   description: Applied filters
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Internal server error
 */
router.get('/logs', (req: Request, res: Response) => {
  try {
    const { level, limit, since, type } = req.query;
    
    // Validate parameters
    const parsedLimit = limit ? parseInt(limit as string, 10) : 100;
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({
        error: {
          message: 'Invalid limit parameter. Must be between 1 and 1000.',
          code: 'invalid_parameter'
        }
      });
    }

    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (level && !validLevels.includes(level as string)) {
      return res.status(400).json({
        error: {
          message: `Invalid level parameter. Must be one of: ${validLevels.join(', ')}`,
          code: 'invalid_parameter'
        }
      });
    }

    const validTypes = ['request', 'response', 'general'];
    if (type && !validTypes.includes(type as string)) {
      return res.status(400).json({
        error: {
          message: `Invalid type parameter. Must be one of: ${validTypes.join(', ')}`,
          code: 'invalid_parameter'
        }
      });
    }

    let sinceDate: string | undefined;
    if (since) {
      const parsedDate = new Date(since as string);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: {
            message: 'Invalid since parameter. Must be a valid ISO 8601 date string.',
            code: 'invalid_parameter'
          }
        });
      }
      sinceDate = parsedDate.toISOString();
    }

    // Get logs with filters
    const logs = logger.getLogs({
      ...(level && { level: level as LogLevel }),
      limit: parsedLimit,
      ...(sinceDate && { since: sinceDate }),
      ...(type && { type: type as 'request' | 'response' | 'general' })
    });

    // Clean up error objects for JSON serialization
    const cleanLogs = logs.map(log => ({
      ...log,
      error: log.error ? {
        message: log.error.message,
        stack: log.error.stack,
        name: log.error.name
      } : undefined
    }));

    return res.json({
      logs: cleanLogs,
      total: cleanLogs.length,
      filters: {
        level: level || 'all',
        limit: parsedLimit,
        since: sinceDate || 'all',
        type: type || 'all'
      }
    });
  } catch (error) {
    logger.error('Error retrieving logs', error as Error, {
      query: req.query,
      requestId: req.requestId
    });
    
    return res.status(500).json({
      error: {
        message: 'Internal server error while retrieving logs',
        code: 'internal_error'
      }
    });
  }
});

/**
 * @swagger
 * /logs/clear:
 *   post:
 *     summary: Clear server logs
 *     description: Clear all stored server logs
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Logs cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 cleared:
 *                   type: boolean
 *       500:
 *         description: Internal server error
 */
router.post('/logs/clear', (req: Request, res: Response) => {
  try {
    logger.clearLogs();
    logger.info('Server logs cleared', { requestId: req.requestId });
    
    return res.json({
      message: 'Server logs cleared successfully',
      cleared: true
    });
  } catch (error) {
    logger.error('Error clearing logs', error as Error, {
      requestId: req.requestId
    });
    
    return res.status(500).json({
      error: {
        message: 'Internal server error while clearing logs',
        code: 'internal_error'
      }
    });
  }
});

export default router;