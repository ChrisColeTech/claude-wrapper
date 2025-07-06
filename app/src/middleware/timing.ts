/**
 * Phase 16A: Minimal request timing middleware
 */

import { Request, Response, NextFunction } from 'express';
import { PerformanceMonitor } from '../monitoring/performance-monitor';

export interface TimingMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
}

export const timingMiddleware: TimingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    PerformanceMonitor.recordRequest(responseTime);
  });

  next();
};