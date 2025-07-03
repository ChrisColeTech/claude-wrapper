/**
 * Routes module exports
 * Implements Phase 11A routes organization
 * Updated for Phase 12A to include auth routes
 * Updated for Phase 13A to include sessions routes
 * Updated for Phase 14A to include debug routes
 */

export * from './models';
export * from './health';
export * from './chat';
export * from './auth';
export * from './sessions';
export * from './debug';

export { default as ModelsRouter } from './models';
export { default as HealthRouter } from './health';
export { default as ChatRouter } from './chat';
export { default as AuthRouter } from './auth';
export { SessionsRouter } from './sessions';
export { DebugRouter } from './debug';