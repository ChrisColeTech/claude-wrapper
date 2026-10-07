/**
 * The composition root's production defaults (spec section 16): with no runner injected a turn
 * spawns `CLAUDE_COMMAND` through the spawn runner, and with no state directory injected the
 * process's own one is opened at the first turn, under `XDG_STATE_HOME`, once per process.
 *
 * The binary is a shim around the stand-in CLI (`tests/mocks/upstream/fake-cli.js`), never Claude
 * Code: `CLAUDE_COMMAND` names the shim, the wrapper's `PATH` (copied into the child's) holds
 * only the shim's directory, where it is also called `claude`, and every turn first checks the
 * shim is in force. The stand-in reports `model: "fake-model"`, which the startup check turns
 * into a 500, and `session_id: "fake-session"`, which that error turn then forgets.
 */
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createServer } from '../../../src/api/server';
import { EnvironmentManager } from '../../../src/config/env';
import { envelopeOf, rejectionOf, serveApp, SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';

const FAKE_CLI = path.resolve(__dirname, '..', '..', 'mocks', 'upstream', 'fake-cli.js');
const request = { model: 'fable', max_tokens: 64, messages: [{ role: 'user' as const, content: 'hi' }] };
const UPSTREAM_ENV = 'CLAUDE_WRAPPER_UPSTREAM_ENV';
const saved = {
  PATH: process.env['PATH'], XDG_STATE_HOME: process.env['XDG_STATE_HOME'], [UPSTREAM_ENV]: process.env[UPSTREAM_ENV]
};

function restoreEnv(name: keyof typeof saved): void {
  const value = saved[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('Anthropic surface: production defaults', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-defaults-'));
  const shimDir = path.join(temp, 'bin');
  const shim = path.join(shimDir, 'claude');
  const stateRoot = path.join(temp, 'state', 'claude-wrapper');
  const surfaces: SurfaceHarness[] = [];

  beforeAll(() => {
    fs.mkdirSync(shimDir);
    fs.writeFileSync(shim, `#!/bin/sh\nexec '${process.execPath}' '${FAKE_CLI}' "$@"\n`, { mode: 0o755 });
    process.env['XDG_STATE_HOME'] = path.join(temp, 'state');
  });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const config = EnvironmentManager.getConfig();
    jest.spyOn(EnvironmentManager, 'getConfig').mockReturnValue({ ...config, claudeCommand: shim });
  });

  afterAll(async () => {
    await Promise.all(surfaces.map(surface => surface.close()));
    restoreEnv('PATH');
    restoreEnv('XDG_STATE_HOME');
    restoreEnv(UPSTREAM_ENV);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  /** A turn on a new app with the shim as the only reachable `claude`. */
  async function turnOnNewApp(): Promise<InstanceType<typeof Anthropic.APIError>> {
    const surface = await serveApp(createServer());
    surfaces.push(surface);
    if (EnvironmentManager.getConfig().claudeCommand !== shim) throw new Error('the CLI shim is not in force');
    process.env['PATH'] = shimDir;
    try {
      return await rejectionOf(surface.client().messages.create(request));
    } finally {
      restoreEnv('PATH');
    }
  }

  it('spawns CLAUDE_COMMAND and opens the state directory at the first turn', async () => {
    expect(fs.existsSync(stateRoot)).toBe(false);

    const error = await turnOnNewApp();

    expect(envelopeOf(error).error).toEqual({
      type: 'api_error', message: 'upstream started model fake-model instead of claude-fable-5-1'
    });
    expect(fs.existsSync(path.join(stateRoot, 'cwd'))).toBe(true);
    await waitFor(() => fs.readdirSync(path.join(stateRoot, 'runs')).length === 0);
  });

  it('keeps one state directory per process: a second app does not empty it', async () => {
    const marker = path.join(stateRoot, 'runs', 'left-by-a-live-run');
    fs.writeFileSync(marker, '');

    await turnOnNewApp();

    expect(fs.existsSync(marker)).toBe(true);
  });

  it("deletes a failed turn's upstream transcript where the child keeps it, and nothing else", async () => {
    const configDir = path.join(temp, 'config');
    process.env[UPSTREAM_ENV] = JSON.stringify({ CLAUDE_CONFIG_DIR: configDir });
    // Claude Code's project directory: the working directory's real path, every non-alphanumeric as '-'.
    const cwd = path.join(fs.realpathSync(temp), 'state', 'claude-wrapper', 'cwd');
    const project = path.join(configDir, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
    fs.mkdirSync(path.join(project, 'fake-session'), { recursive: true });
    fs.writeFileSync(path.join(project, 'fake-session.jsonl'), '{}\n');
    fs.writeFileSync(path.join(project, 'another-session.jsonl'), '{}\n');

    await turnOnNewApp();

    await waitFor(() => !fs.existsSync(path.join(project, 'fake-session.jsonl')));
    expect(fs.readdirSync(project)).toEqual(['another-session.jsonl']);
  });
});
