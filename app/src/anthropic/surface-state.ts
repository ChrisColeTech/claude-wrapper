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
  /** Opened on first use (wrapper start, else the first turn), unless injected. */
  stateDirectory: () => StateDirectory;
  sessions: Sessions;
  /** Present with the production fingerprint map: the wrapper's start starts it, the shutdown stops it. */
  retention?: Retention;
}

/**
 * Injected sessions keep their own transcripts. Otherwise an empty fingerprint map (a restart
 * forgets every conversation) whose forgets delete upstream's transcript where a run's child keeps
 * it: its `HOME` is the wrapper's (from `environment`) unless `upstream.env` sets one (or
 * `CLAUDE_CONFIG_DIR`), its working directory the state directory's. Its retention, started with
 * the wrapper, sweeps the transcripts an earlier process left, then hourly.
 */
export function surfaceState(
  deps: SurfaceDeps, settings: AnthropicSettings, clock: Clock, environment: Readonly<Record<string, string | undefined>>
): SurfaceState {
  const injected = deps.stateDirectory;
  const stateDirectory = injected ? () => injected : () => processStateDirectory();
  if (deps.sessions) return { stateDirectory, sessions: deps.sessions };
  const childEnv = { HOME: environment['HOME'], ...settings.upstreamEnv };
  const transcripts = createTranscriptStore(() => upstreamProjectDirectory(stateDirectory().cwd, childEnv));
  const retention = createRetention({ transcripts, clock, expiryMs: settings.fingerprintExpiryMs });
  const sessions = createSessions({
    clock, capacity: settings.fingerprintCapacity, expiryMs: settings.fingerprintExpiryMs, transcripts
  });
  return { stateDirectory, sessions, retention };
}
