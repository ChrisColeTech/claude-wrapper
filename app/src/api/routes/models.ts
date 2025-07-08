import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';
import { logger } from '../../utils/logger';

const router = Router();

// Working Claude models
const CLAUDE_MODELS = [
  { id: 'sonnet', object: 'model', owned_by: 'anthropic', created: 1709164800 },
  { id: 'opus', object: 'model', owned_by: 'anthropic', created: 1709164800 }
];

router.get('/v1/models', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Returning available Claude models', { count: CLAUDE_MODELS.length });
  
  res.json({
    object: 'list',
    data: CLAUDE_MODELS
  });
}));

export default router;