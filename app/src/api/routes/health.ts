import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/error';
import * as packageJson from '../../../package.json';

const router = Router();

router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    service: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    timestamp: new Date().toISOString()
  });
}));

export default router;