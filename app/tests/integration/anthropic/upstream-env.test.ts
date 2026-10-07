/**
 * The operator's `upstream.env` (spec section 10): the two variables refused even from the
 * operator stop the wrapper at startup, before it serves anything.
 */
import { createServer } from '../../../src/api/server';

const UPSTREAM_ENV = 'CLAUDE_WRAPPER_UPSTREAM_ENV';

describe('upstream.env at startup', () => {
  afterEach(() => {
    delete process.env[UPSTREAM_ENV];
  });

  it.each(['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC', 'CLAUDE_CODE_SIMPLE'])(
    'refuses to build the app when it sets %s',
    (name) => {
      process.env[UPSTREAM_ENV] = JSON.stringify({ DISABLE_TELEMETRY: '1', [name]: '1' });

      expect(() => createServer()).toThrow(`${UPSTREAM_ENV} may not set ${name}`);
    }
  );

  it('builds the app with the variables the operator may choose', () => {
    process.env[UPSTREAM_ENV] = JSON.stringify({ ANTHROPIC_API_KEY: 'sk-ant-operator', DISABLE_TELEMETRY: '1' });

    expect(() => createServer()).not.toThrow();
  });
});
