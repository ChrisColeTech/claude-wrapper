/**
 * The unit project loads the real-CLI guard (`tests/setup/real-cli-guard.ts`); the spawning proof
 * is `tests/integration/real-cli-guard.test.ts`. With UPSTREAM_E2E=1 the guard steps aside.
 */
import * as path from 'path';
import { EnvironmentManager } from '../../src/config/env';

const BLOCKED_CLI = path.resolve(__dirname, '..', 'setup', 'blocked-cli', 'claude');
const flagged = process.env['UPSTREAM_E2E'] === '1';
const pathEntries = (): string[] => (process.env['PATH'] ?? '').split(path.delimiter);

describe('real CLI guard in the unit project', () => {
  (flagged ? it.skip : it)('names the shim as CLAUDE_COMMAND and puts its directory first on PATH', () => {
    expect(EnvironmentManager.getConfig().claudeCommand).toBe(BLOCKED_CLI);
    expect(pathEntries()[0]).toBe(path.dirname(BLOCKED_CLI));
  });

  (flagged ? it : it.skip)('steps aside with UPSTREAM_E2E=1', () => {
    expect(process.env['CLAUDE_COMMAND']).not.toBe(BLOCKED_CLI);
    expect(pathEntries()).not.toContain(path.dirname(BLOCKED_CLI));
  });
});
