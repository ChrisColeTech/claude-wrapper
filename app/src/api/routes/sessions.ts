import { Router } from 'express';

const router = Router();

// Session management endpoints
router.get('/sessions', (_req, res) => {
  res.json({ sessions: [] });
});

export default router;