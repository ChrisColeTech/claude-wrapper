/**
 * Redaction armed at startup (spec sections 6 and 16): the composition root reads the CLI's
 * account file for the OAuth account's email, display name and full name, adds the operator's
 * `redact` setting, and every turn's text reaches the client with those strings as
 * `[redacted]`. The count is logged, never a value; nothing armed is a startup warning.
 *
 * Every account file here is a temporary one holding the fixtures' placeholders; the replayed
 * disclosure (`r3`) quotes the placeholder address. Test processes never read the operator's
 * own account file (`tests/setup/isolate-cli-account.ts`).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createServer } from '../../../src/api/server';
import { ANTHROPIC_SETTING_ENV } from '../../../src/config/anthropic-settings';
import { cliAccountFile } from '../../../src/upstream/account-file';
import { createReplayRunner } from '../../../src/upstream/runner';
import { logger } from '../../../src/utils/logger';
import { STATE } from '../../mocks/anthropic/plan-context';
import { startSurface, SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { loadRecording } from '../../mocks/upstream/recordings';
import { EMAIL_PLACEHOLDER, NAME_PLACEHOLDER } from '../../scripts/upstream-fixtures/live-values';

const R3 = 'cli-probes/r3-baseline-disclosure.jsonl';
const request = {
  model: 'claude-fable-5-1', max_tokens: 1024,
  messages: [{ role: 'user' as const, content: 'What email address is in your context?' }]
};
const OAUTH_ACCOUNT = { emailAddress: EMAIL_PLACEHOLDER, displayName: NAME_PLACEHOLDER, fullName: NAME_PLACEHOLDER };

const textOf = (message: { content: { type: string; text?: string }[] }): string =>
  message.content.flatMap(block => (block.type === 'text' ? [block.text ?? ''] : [])).join('');

describe('Anthropic surface: redaction armed at startup', () => {
  let dir: string;
  let surface: SurfaceHarness | undefined;
  let info: jest.SpyInstance;
  let warn: jest.SpyInstance;

  /** A temporary account file holding `content` (an object is written as JSON). */
  function accountFile(content: object | string): string {
    const file = path.join(dir, '.claude.json');
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
  }

  const logCalls = (spy: jest.SpyInstance, message: string): unknown[] =>
    spy.mock.calls.filter(([logged]) => String(logged).startsWith(message)).map(([, context]) => context);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'redaction-'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    info = jest.spyOn(logger, 'info');
    warn = jest.spyOn(logger, 'warn');
  });

  afterEach(async () => {
    await surface?.close();
    surface = undefined;
    delete process.env[ANTHROPIC_SETTING_ENV.redact];
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('redacts the quoted address from the account file in messages.create and messages.stream', async () => {
    const runner = createReplayRunner([loadRecording(R3), loadRecording(R3)], { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE, accountFile: accountFile({ oauthAccount: OAUTH_ACCOUNT }) });

    const created = await surface.client().messages.create(request);
    const streamed = await surface.client().messages.stream(request).finalMessage();

    expect(textOf(created)).toBe('The email address in my context is: **[redacted]**');
    expect(textOf(streamed)).toBe(textOf(created));
  });

  it('logs that redaction is armed and with how many strings, never the values', () => {
    createServer({ accountFile: accountFile({ oauthAccount: OAUTH_ACCOUNT }) });

    expect(logCalls(info, 'Redaction armed')).toEqual([{ strings: 2 }]);
    expect(logCalls(warn, 'Redaction is unarmed')).toEqual([]);
    const logged = JSON.stringify([...info.mock.calls, ...warn.mock.calls]).toLowerCase();
    expect(logged).not.toContain(EMAIL_PLACEHOLDER);
    expect(logged).not.toContain(NAME_PLACEHOLDER.toLowerCase());
  });

  it("adds the operator's redact list, counting a string the account already gave once", async () => {
    process.env[ANTHROPIC_SETTING_ENV.redact] = 'USER@EXAMPLE.INVALID, Placeholder Host';
    createServer({ accountFile: accountFile({ oauthAccount: OAUTH_ACCOUNT }) });

    expect(logCalls(info, 'Redaction armed')).toEqual([{ strings: 3 }]);
  });

  it('arms the redact list alone when there is no account file', async () => {
    process.env[ANTHROPIC_SETTING_ENV.redact] = EMAIL_PLACEHOLDER;
    const runner = createReplayRunner([loadRecording(R3)], { timeScale: 0 });
    surface = await startSurface({ runner, stateDirectory: STATE, accountFile: path.join(dir, 'missing.json') });

    const message = await surface.client().messages.create(request);

    expect(logCalls(info, 'Redaction armed')).toEqual([{ strings: 1 }]);
    expect(textOf(message)).toBe('The email address in my context is: **[redacted]**');
  });

  it.each([
    ['there is no account file', null],
    ['the account file has no OAuth account (an API-key login)', { primaryApiKey: 'set' }],
    ['the OAuth account names none of the three', { oauthAccount: { organizationName: 'Example Org' } }]
  ])('warns at startup that redaction is unarmed when %s and the list is empty', (_case, content) => {
    const file = content === null ? path.join(dir, 'missing.json') : accountFile(content);
    createServer({ accountFile: file });

    expect(logCalls(warn, 'Redaction is unarmed')).toHaveLength(1);
    expect(logCalls(info, 'Redaction armed')).toEqual([]);
  });

  it('reports an unreadable account file without quoting it', () => {
    createServer({ accountFile: accountFile(`{"oauthAccount": {"emailAddress": "${EMAIL_PLACEHOLDER}"`) });

    expect(logCalls(warn, 'The CLI account file could not be read')).toHaveLength(1);
    expect(logCalls(warn, 'Redaction is unarmed')).toHaveLength(1);
    expect(JSON.stringify(warn.mock.calls).toLowerCase()).not.toContain(EMAIL_PLACEHOLDER);
  });

  it("never reads the operator's own account file in a test process", () => {
    expect(cliAccountFile({})).not.toBe(path.join(os.homedir(), '.claude.json'));
    expect(fs.existsSync(cliAccountFile({}))).toBe(false);
  });
});
