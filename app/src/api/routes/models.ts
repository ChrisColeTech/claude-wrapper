import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';
import { logger } from '../../utils/logger';

const router = Router();

// Latest Claude models as of 2025
const CLAUDE_MODELS = [
  // Claude 4 Models (Latest - May 2025)
  { id: 'claude-4-opus', object: 'model', owned_by: 'anthropic', created: 1714521600 },
  { id: 'claude-4-sonnet', object: 'model', owned_by: 'anthropic', created: 1714521600 },
  
  // Claude 3.7 Sonnet (February 2025)
  { id: 'claude-3-7-sonnet', object: 'model', owned_by: 'anthropic', created: 1706745600 },
  
  // Claude 3.5 Models (Updated)
  { id: 'claude-3-5-sonnet-20241022', object: 'model', owned_by: 'anthropic', created: 1729555200 },
  { id: 'claude-3-5-haiku-20241022', object: 'model', owned_by: 'anthropic', created: 1729555200 },
  
  // Claude 3 Models (Original family)
  { id: 'claude-3-opus-20240229', object: 'model', owned_by: 'anthropic', created: 1709164800 },
  { id: 'claude-3-sonnet-20240229', object: 'model', owned_by: 'anthropic', created: 1709164800 },
  { id: 'claude-3-haiku-20240307', object: 'model', owned_by: 'anthropic', created: 1709769600 }
];

router.get('/v1/models', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Returning available Claude models', { count: CLAUDE_MODELS.length });
  
  res.json({
    object: 'list',
    data: CLAUDE_MODELS
  });
}));

export default router;