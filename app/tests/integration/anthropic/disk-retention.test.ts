/**
 * Disk retention with the production sessions and state directory (spec section 14): at wrapper
 * start, before any turn, every transcript in the runs' project directory is an orphan of an
 * earlier wrapper process and is deleted; an hourly sweep, also from wrapper start, then deletes
 * the transcripts last written longer ago than the fingerprint expiry, as a backstop; the shutdown
 * stops it. The state directory and upstream's config directory are temporary; upstream is
 * scripted; the hourly sweep runs on a fake clock.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createServer } from '../../../src/api/server';
import { serveApp, SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { initFrame, PLAIN_CALL, resultFrame, streamEvent } from '../../mocks/anthropic/turn-frames';
import { createFakeClock, FakeClock } from '../../mocks/shared/fake-clock';
import { waitFor } from '../../mocks/shared/wait-for';
import { createScriptedRunner, ScriptedRunner } from '../../mocks/upstream/scripted-runner';

const HOUR = 3_600_000;
const UPSTREAM_ENV = 'CLAUDE_WRAPPER_UPSTREAM_ENV';
const request = { model: 'fable', max_tokens: 64, messages: [{ role: 'user' as const, content: 'hi' }] };
const saved = { XDG_STATE_HOME: process.env['XDG_STATE_HOME'], [UPSTREAM_ENV]: process.env[UPSTREAM_ENV] };

function restoreEnv(name: keyof typeof saved): void {
  const value = saved[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('Anthropic surface: disk retention', () => {
  const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'disk-retention-')));
  const configDir = path.join(temp, 'config');
  // Claude Code's project directory: the working directory's real path, every non-alphanumeric as '-'.
  const project = path.join(configDir, 'projects', path.join(temp, 'state', 'claude-wrapper', 'cwd').replace(/[^a-zA-Z0-9]/g, '-'));
  const at = (name: string) => path.join(project, name);
  let clock: FakeClock;
  let runner: ScriptedRunner;
  let surface: SurfaceHarness;

  /** A transcript last written `ageMs` before the clock's now. */
  function transcript(id: string, ageMs = 0): void {
    fs.mkdirSync(project, { recursive: true });
    fs.writeFileSync(at(`${id}.jsonl`), '{}\n');
    const writtenAt = (clock.now() - ageMs) / 1000;
    fs.utimesSync(at(`${id}.jsonl`), writtenAt, writtenAt);
  }

  /** One clean turn on the surface. */
  async function turn(): Promise<void> {
    const answered = surface.client().messages.create(request);
    const { process: upstream } = await runner.nextRun();
    await waitFor(() => upstream.writtenLines().length >= 1);
    upstream.frames(initFrame(), ...PLAIN_CALL.map(event => streamEvent(event)), resultFrame());
    await waitFor(() => upstream.inputEnded());
    upstream.exit(0);
    await answered;
  }

  async function serve(): Promise<void> {
    runner = createScriptedRunner(clock);
    surface = await serveApp(createServer({ runner, clock }));
  }

  beforeAll(() => {
    process.env['XDG_STATE_HOME'] = path.join(temp, 'state');
    process.env[UPSTREAM_ENV] = JSON.stringify({ CLAUDE_CONFIG_DIR: configDir });
  });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    clock = createFakeClock(Date.now());
  });

  afterEach(async () => {
    await surface.shutdown();
    await surface.close();
  });

  afterAll(() => {
    restoreEnv('XDG_STATE_HOME');
    restoreEnv(UPSTREAM_ENV);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  it("deletes an earlier process's transcripts at wrapper start, before any turn, and only then", async () => {
    transcript('orphan-1');
    fs.mkdirSync(at('orphan-1'));
    transcript('orphan-2');
    await serve();
    expect(fs.readdirSync(project)).toHaveLength(3);

    surface.start();
    expect(fs.readdirSync(project)).toEqual([]);
    transcript('written-since');
    await turn();

    expect(fs.readdirSync(project)).toEqual(['written-since.jsonl']);
  });

  it('sweeps the transcripts idle past the expiry every hour from wrapper start, until the shutdown', async () => {
    await serve();
    surface.start();
    transcript('stale', 25 * HOUR);
    transcript('fresh', HOUR);

    clock.advance(HOUR - 1);
    expect(fs.existsSync(at('stale.jsonl'))).toBe(true);
    clock.advance(1);

    expect(fs.existsSync(at('stale.jsonl'))).toBe(false);
    expect(fs.existsSync(at('fresh.jsonl'))).toBe(true);
    await surface.shutdown();
    transcript('stale-after-shutdown', 25 * HOUR);
    clock.advance(HOUR);
    expect(fs.existsSync(at('stale-after-shutdown.jsonl'))).toBe(true);
  });
});
