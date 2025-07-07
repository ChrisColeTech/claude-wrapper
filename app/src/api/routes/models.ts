import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.get('/v1/models', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    object: 'list',
    data: [
      { id: 'claude-3-5-sonnet-20241022', object: 'model', owned_by: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', object: 'model', owned_by: 'anthropic' }
    ]
  });
}));

export default router;