/**
 * The request module's interface (spec section 16): `planTurn(request, catalogue, sessions,
 * context) → TurnPlan | SurfaceError`. Inside, one pure file per validation concern, the
 * normaliser, the replayed-turn renderer and the run spec (argument list, environment allowlist).
 */
export { planTurn } from './plan-turn';
export { checkUpstreamEnv } from './child-environment';
export { withoutIgnoredContent } from './ignored-content';
export type { ClientMessage } from './validate-messages';
export type {
  ContentBlock, Continuation, NormalisedMessage, RunContext, StartupChecks, TurnPlan
} from './turn-plan';
