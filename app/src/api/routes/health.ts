import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';

const router = Router();

router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    service: 'claude-wrapper-poc',
    timestamp: new Date().toISOString()
  });
}));

export default router;