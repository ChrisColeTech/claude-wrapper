/**
 * Phase 16A: Minimal monitoring routes
 */

import { Router } from 'express';
import { PerformanceMonitor } from '../monitoring/performance-monitor';

const router = Router();

// GET /monitoring/performance
router.get('/performance', (req, res) => {
  const metrics = PerformanceMonitor.getMetrics();
  res.json(metrics);
});

// GET /monitoring/status
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

export default router;