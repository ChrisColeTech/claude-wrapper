/**
 * Phase 16A: Basic debug router for API diagnostics
 */

import { Router } from 'express';

const router = Router();

// GET /debug/info
router.get('/info', (req, res) => {
  res.json({
    version: '1.0.0',
    phase: '16A',
    features: ['chat_completions', 'health_monitoring'],
    tools_supported: false,
    api_compatibility: 'openai_v1'
  });
});

// GET /debug/health
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

export default router;