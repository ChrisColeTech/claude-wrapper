import { loadAnthropicSettings } from '../../../src/config/anthropic-settings';
import { EnvironmentManager } from '../../../src/config/env';

// Defaults from the spec's operator settings table (section 15).
const SPEC_DEFAULTS = {
  parkTtlMs: 600_000,
  fingerprintExpiryMs: 86_400_000,
  fingerprintCapacity: 1000,
  retryCapMs: 60_000,
  pingIntervalMs: 15_000,
  cataloguePath: null,
  connectorHosts: [],
  connectorCallTimeoutMs: 60_000,
  timers: { startupMs: 20_000, stallMs: 90_000, lifetimeMs: 1_800_000 },
  maxRuns: 4,
  continuedTurnWaitMs: 10_000,
  shutdownDrainMs: 15_000,
  maxTurns: 25,
  upstreamEnv: {},
  redact: []
};

describe('Anthropic surface settings', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('carries every operator setting at its spec default when nothing is set', () => {
    expect(loadAnthropicSettings({})).toEqual(SPEC_DEFAULTS);
  });

  it('reads every numeric setting from its environment variable', () => {
    const settings = loadAnthropicSettings({
      CLAUDE_WRAPPER_PARK_TTL_MS: '1',
      CLAUDE_WRAPPER_FINGERPRINT_EXPIRY_MS: '2',
      CLAUDE_WRAPPER_FINGERPRINT_CAPACITY: '3',
      CLAUDE_WRAPPER_RETRY_CAP_MS: '4',
      CLAUDE_WRAPPER_PING_INTERVAL_MS: '5',
      CLAUDE_WRAPPER_CONNECTOR_TIMEOUT_MS: '6',
      CLAUDE_WRAPPER_STARTUP_TIMEOUT_MS: '7',
      CLAUDE_WRAPPER_STALL_TIMEOUT_MS: '8',
      CLAUDE_WRAPPER_RUN_LIFETIME_MS: '9',
      CLAUDE_WRAPPER_MAX_RUNS: '10',
      CLAUDE_WRAPPER_CONTINUED_TURN_WAIT_MS: '11',
      CLAUDE_WRAPPER_SHUTDOWN_DRAIN_MS: '12',
      CLAUDE_WRAPPER_MAX_TURNS: '13'
    });

    expect(settings).toEqual({
      ...SPEC_DEFAULTS,
      parkTtlMs: 1,
      fingerprintExpiryMs: 2,
      fingerprintCapacity: 3,
      retryCapMs: 4,
      pingIntervalMs: 5,
      connectorCallTimeoutMs: 6,
      timers: { startupMs: 7, stallMs: 8, lifetimeMs: 9 },
      maxRuns: 10,
      continuedTurnWaitMs: 11,
      shutdownDrainMs: 12,
      maxTurns: 13
    });
  });

  it.each(['abc', '0', '-5', '2.5', ''])('keeps the default, with a warning, for the number %p', (value) => {
    const settings = loadAnthropicSettings({ CLAUDE_WRAPPER_MAX_RUNS: value });

    expect(settings.maxRuns).toBe(4);
    if (value !== '') {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('CLAUDE_WRAPPER_MAX_RUNS'));
    }
  });

  it('reads the catalogue path', () => {
    expect(loadAnthropicSettings({ CLAUDE_WRAPPER_CATALOGUE_PATH: '/etc/models.json' }).cataloguePath)
      .toBe('/etc/models.json');
  });

  it('reads the connector host list and the redact list as comma-separated values', () => {
    const settings = loadAnthropicSettings({
      CLAUDE_WRAPPER_CONNECTOR_HOSTS: ' mcp.example.com, ,tools.example.org ',
      CLAUDE_WRAPPER_REDACT: 'operator,Operator Name'
    });

    expect(settings.connectorHosts).toEqual(['mcp.example.com', 'tools.example.org']);
    expect(settings.redact).toEqual(['operator', 'Operator Name']);
  });

  it('reads upstream.env as a JSON object of strings', () => {
    const settings = loadAnthropicSettings({ CLAUDE_WRAPPER_UPSTREAM_ENV: '{"DISABLE_TELEMETRY":"1","ANTHROPIC_API_KEY":"sk-x"}' });

    expect(settings.upstreamEnv).toEqual({ DISABLE_TELEMETRY: '1', ANTHROPIC_API_KEY: 'sk-x' });
  });

  it.each(['{"ANTHROPIC_API_KEY": "sk-secret"', '["sk-secret"]', '{"PORT": 8080}', '"sk-secret"'])(
    'keeps upstream.env empty for %p, warning without echoing the value',
    (value) => {
      const settings = loadAnthropicSettings({ CLAUDE_WRAPPER_UPSTREAM_ENV: value });

      expect(settings.upstreamEnv).toEqual({});
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('CLAUDE_WRAPPER_UPSTREAM_ENV'));
      expect(warn.mock.calls.flat().join(' ')).not.toContain('sk-secret');
    }
  );

  it('is loaded through the existing configuration module from the process environment', () => {
    process.env['CLAUDE_WRAPPER_MAX_TURNS'] = '7';
    try {
      expect(EnvironmentManager.getAnthropicSettings()).toEqual({ ...SPEC_DEFAULTS, maxTurns: 7 });
    } finally {
      delete process.env['CLAUDE_WRAPPER_MAX_TURNS'];
    }
  });
});
