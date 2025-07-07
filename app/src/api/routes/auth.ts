import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';
import { EnvironmentManager } from '../../config/env';

const router = Router();

// Authentication status endpoint
router.get('/v1/auth/status', asyncHandler(async (_req: Request, res: Response) => {
  const requiresAuth = EnvironmentManager.getRequiredApiKey();
  
  res.json({
    authenticated: false,
    required: requiresAuth,
    status: 'ready'
  });
}));

export default router;