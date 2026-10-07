/**
 * The surface's state, in memory and on disk (spec sections 5 and 14): the state directory (the
 * process's own unless injected), the fingerprint map, and, with the production fingerprint map,
 * the retention of the transcripts upstream keeps for it.
 */
import { AnthropicSettings } from '../config/anthropic-settings';
import { processStateDirectory, StateDirectory } from '../upstream/state-directory';
import { createTranscriptStore, upstreamProjectDirectory } from '../upstream/transcripts';
import { Clock } from '../utils/clock';
import { SurfaceDeps } from './deps';
import { createRetention, Retention } from './retention';
import { createSessions, Sessions } from './sessions';

export interface SurfaceState {
  /** Opened at the first turn, unless injected. */
  stateDirectory: () => StateDirectory;
  sessions: Sessions;
  /** Present with the production fingerprint map; the shutdown stops it. */
  retention?: Retention;
}

/**
 * Injected sessions keep their own transcripts. Otherwise an empty fingerprint map (a restart
 * forgets every conversation) whose forgets delete upstream's transcript where a run's child keeps
 * it: its `HOME` is the wrapper's unless `upstream.env` sets one (or `CLAUDE_CONFIG_DIR`), its
 * working directory the state directory's. Opening the process's state directory sweeps the
 * transcripts an earlier process left; the first turn starts the hourly sweep.
 */
export function surfaceState(deps: SurfaceDeps, settings: AnthropicSettings, clock: Clock): SurfaceState {
  const injected = deps.stateDirectory;
  if (deps.sessions) {
    return { stateDirectory: injected ? () => injected : () => processStateDirectory(), sessions: deps.sessions };
  }
  const childEnv = { HOME: process.env['HOME'], ...settings.upstreamEnv };
  const transcripts = createTranscriptStore(() => upstreamProjectDirectory(stateDirectory().cwd, childEnv));
  const retention = createRetention({ transcripts, clock, expiryMs: settings.fingerprintExpiryMs });
  const open = injected ? () => injected : () => processStateDirectory(() => retention.sweepOrphans());
  const stateDirectory = (): StateDirectory => {
    const state = open();
    retention.start();
    return state;
  };
  const sessions = createSessions({
    clock, capacity: settings.fingerprintCapacity, expiryMs: settings.fingerprintExpiryMs, transcripts
  });
  return { stateDirectory, sessions, retention };
}
