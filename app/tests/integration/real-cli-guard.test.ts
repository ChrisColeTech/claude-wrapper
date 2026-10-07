/**
 * The real-CLI guard (`tests/setup/real-cli-guard.ts`): in the unit and integration projects and
 * `test:ci`, Claude Code is replaced by a shim that exits 97 with "real CLI blocked in tests", so
 * a test that reaches the production runner fails loudly instead of spending subscription quota.
 * These tests reach it on purpose, by each road a test could take: the spawn runner's default
 * command, `claude` on the child's PATH, a surface app built with no runner (how ticket 29's draft
 * test got through), and the OpenAI surface's resolver. With UPSTREAM_E2E=1 the guard steps aside,
 * so these are skipped; the app is then never imported, because importing it starts the OpenAI
 * surface's streaming interval, which only a test's `afterEach` stops.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EnvironmentManager } from '../../src/config/env';
import { ClaudeResolver } from '../../src/core/claude-resolver';
import { createSpawnRunner, RunExit, Runner } from '../../src/upstream/runner';
import { openStateDirectory } from '../../src/upstream/state-directory';
import { NO_TIMERS } from '../mocks/upstream/run-helpers';

const BLOCKED_CLI = path.resolve(__dirname, '..', 'setup', 'blocked-cli', 'claude');
const BLOCKED = 'real CLI blocked in tests';
const describeGuarded = process.env['UPSTREAM_E2E'] === '1' ? describe.skip : describe;

describeGuarded('real CLI guard', () => {
  let temp = '';

  beforeEach(() => {
    temp = '';
    // Spawn nothing unless the shim is in force: without it these tests would reach Claude Code.
    const firstOnPath = (process.env['PATH'] ?? '').split(path.delimiter)[0];
    if (EnvironmentManager.getConfig().claudeCommand !== BLOCKED_CLI || firstOnPath !== path.dirname(BLOCKED_CLI)) {
      throw new Error('the real CLI guard is not in force: refusing to spawn anything');
    }
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'real-cli-guard-'));
  });

  afterEach(() => {
    if (temp) fs.rmSync(temp, { recursive: true, force: true });
  });

  function exitOf(runner: Runner): Promise<RunExit> {
    const env = { PATH: process.env['PATH'] ?? '' };
    return runner.startRun({ flags: ['-p'], env, cwd: temp, timers: NO_TIMERS }).exited;
  }

  it.each([
    ['the production default runner (CLAUDE_COMMAND)', () => createSpawnRunner()],
    ['`claude` looked up on the child PATH', () => createSpawnRunner({ command: 'claude' })]
  ])('%s exits 97 with the blocked message', async (_road, runner) => {
    const exit = await exitOf(runner());

    expect(exit.code).toBe(97);
    expect(exit.stderr).toContain(BLOCKED);
  });

  it('fails a turn on an app built with no runner instead of reaching Claude Code', async () => {
    const { createServer } = await import('../../src/api/server');
    const { envelopeOf, rejectionOf, serveApp } = await import('../mocks/anthropic/surface-harness');
    const stateDirectory = openStateDirectory(path.join(temp, 'state'));
    const surface = await serveApp(createServer({ stateDirectory }));
    try {
      const request = { model: 'fable', max_tokens: 64, messages: [{ role: 'user' as const, content: 'hi' }] };
      const error = await rejectionOf(surface.client().messages.create(request));

      expect(error.status).toBe(500);
      expect(envelopeOf(error).error.message).toBe('upstream exited with code 97');
    } finally {
      await surface.close();
    }
  });

  it('points the OpenAI surface’s resolver at the shim, so its CLI call fails', async () => {
    const resolver = new ClaudeResolver();

    await expect(resolver.findClaudeCommand()).resolves.toBe(BLOCKED_CLI);
    await expect(resolver.executeClaudeCommand('hi', 'sonnet')).rejects.toThrow('Claude CLI execution failed');
  });
});
