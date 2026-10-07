/**
 * The hook client round trip (spec sections 8 and 16, e2e scenario 7 without the CLI): upstream
 * runs the settings file's command through the shell with the hook input on stdin; the shipped
 * hook client posts it to the run's hook endpoint with the run's token, read from the run's
 * `0600` endpoint file, and prints the policy's reply. Whatever goes wrong, it prints a denial
 * and exits 0, so the gate fails closed (upstream lets a call through when a hook fails).
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlServer, createControlServer } from '../../../src/upstream/control-server';
import { createHookPolicy } from '../../../src/upstream/hook-policy';
import {
  HOOK_ENDPOINT_FILE_NAME, hookCommand, hookEndpointContent, hookSettingsContent
} from '../../../src/upstream/hook-settings';
import { recordedHookCalls } from '../../mocks/upstream/hook-recordings';

const [allowedCall, deniedCall] = recordedHookCalls('s-websearch-allowed-then-deny');
const quiet = { debug: () => undefined, warn: () => undefined, error: () => undefined };

/** Runs `command` as upstream runs a command hook: through the shell, the hook input on stdin. */
function runHook(command: string, stdin: string): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/sh', ['-c', command], { env: { PATH: process.env['PATH'] ?? '' } });
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout }));
    child.stdin.end(stdin);
  });
}

const reasonOf = (stdout: string): string =>
  (JSON.parse(stdout) as { hookSpecificOutput: { permissionDecisionReason: string } }).hookSpecificOutput.permissionDecisionReason;

describe('hook client round trip through the control server (spec section 16, scenario 7)', () => {
  let control: ControlServer;
  let runDir: string;
  let endpointFile: string;

  beforeEach(async () => {
    control = createControlServer({ logger: quiet });
    await control.start();
    // A directory name the shell must not split or unquote.
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), "hook client's run "));
    endpointFile = path.join(runDir, HOOK_ENDPOINT_FILE_NAME);
  });

  afterEach(async () => {
    await control.close();
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  const register = (spec: Parameters<typeof createHookPolicy>[0]) => {
    const policy = createHookPolicy(spec, { logger: quiet });
    const { hookUrl, token } = control.registerRun('run-1', { hookHandler: async input => policy.decide(input) });
    fs.writeFileSync(endpointFile, hookEndpointContent({ url: hookUrl, token }), { mode: 0o600 });
    return { policy, token };
  };

  it("prints the run's policy reply for each call, and the policy keeps its decisions", async () => {
    const { policy } = register({ WebSearch: { maxUses: 1, allowedDomains: ['github.com'] } });
    const command = hookCommand({ endpointFile });

    const first = await runHook(command, JSON.stringify(allowedCall?.stdin));
    const second = await runHook(command, JSON.stringify(deniedCall?.stdin));

    expect(first.code).toBe(0);
    expect(JSON.parse(first.stdout)).toEqual(allowedCall?.reply);
    expect(second.code).toBe(0);
    expect(reasonOf(second.stdout)).toMatch(/^max_uses_exceeded: /);
    expect(policy.denialOf(String(deniedCall?.stdin.tool_use_id))).toBe('max_uses_exceeded');
  });

  it('keeps the token out of the command and the settings file: it is only in the endpoint file', () => {
    const { token } = register({ WebSearch: {} });
    const command = hookCommand({ endpointFile });

    expect(command).not.toContain(token);
    expect(hookSettingsContent(command)).not.toContain(token);
    expect(fs.readFileSync(endpointFile, 'utf8')).toContain(token);
  });

  it('denies, exit 0, when the endpoint refuses the token', async () => {
    register({ WebSearch: {} });
    fs.writeFileSync(endpointFile, hookEndpointContent({ url: `${(await control.start()).baseUrl}/runs/run-1/hook`, token: 'wrong' }));

    const { code, stdout } = await runHook(hookCommand({ endpointFile }), JSON.stringify(allowedCall?.stdin));

    expect(code).toBe(0);
    expect(reasonOf(stdout)).toMatch(/^unavailable: /);
  });

  it('denies, exit 0, when nothing answers at the endpoint', async () => {
    register({ WebSearch: {} });
    await control.close();

    const { code, stdout } = await runHook(hookCommand({ endpointFile }), JSON.stringify(allowedCall?.stdin));

    expect(code).toBe(0);
    expect(reasonOf(stdout)).toMatch(/^unavailable: /);
  });

  it('denies, exit 0, when the endpoint file is missing', async () => {
    const { code, stdout } = await runHook(hookCommand({ endpointFile }), JSON.stringify(allowedCall?.stdin));

    expect(code).toBe(0);
    expect(reasonOf(stdout)).toMatch(/^unavailable: /);
  });

  it('holds the command in the settings file upstream loads: a PreToolUse hook on WebSearch|WebFetch', () => {
    const command = hookCommand({ endpointFile });

    expect(JSON.parse(hookSettingsContent(command))).toEqual({
      hooks: { PreToolUse: [{ matcher: 'WebSearch|WebFetch', hooks: [{ type: 'command', command, timeout: 30 }] }] }
    });
    expect(command.startsWith(`'${process.execPath}' `)).toBe(true);
  });
});
