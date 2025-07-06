/**
 * Phase 16A: Simple routes exports
 */

import { Router } from 'express';

// Create placeholder routers for missing routes
const ModelsRouter = Router();
ModelsRouter.get('/', (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'claude-3-5-sonnet-20241022',
        object: 'model',
        created: 1234567890,
        owned_by: 'anthropic'
      }
    ]
  });
});

const AuthRouter = Router();
AuthRouter.get('/status', (req, res) => {
  res.json({ authenticated: true, provider: 'claude-code' });
});

// Export routers
export { default as HealthRouter } from './health';
export { default as ChatRouter } from './chat';
export { default as SessionsRouter } from './sessions';
export { default as DebugRouter } from './debug';
export { ModelsRouter, AuthRouter };