/**
 * The surface error (spec section 13): the one error type every module of the Anthropic surface
 * throws or returns, and the HTTP layer renders.
 */
export { SurfaceError } from './surface-error';
export type { SurfaceErrorOptions, SurfaceErrorType } from './surface-error';
