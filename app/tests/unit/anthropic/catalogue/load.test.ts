import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadCatalogue } from '../../../../src/anthropic/catalogue';

const support = (supported: boolean) => ({ supported });

function capabilities(): Record<string, unknown> {
  return {
    batch: support(false),
    citations: support(false),
    code_execution: support(false),
    context_management: {
      supported: false,
      clear_thinking_20251015: support(false),
      clear_tool_uses_20250919: null,
      compact_20260112: support(false)
    },
    effort: { supported: true, low: support(true), medium: support(true), high: support(true), xhigh: null, max: support(true) },
    image_input: support(true),
    pdf_input: support(true),
    structured_outputs: support(true),
    thinking: { supported: true, types: { adaptive: support(true), enabled: support(false) } }
  };
}

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'op-model-1',
    type: 'model',
    display_name: 'Operator Model 1',
    created_at: '2026-05-01T12:30:00.5+02:00',
    max_input_tokens: 50_000,
    max_tokens: 8_000,
    capabilities: capabilities(),
    aliases: ['op'],
    ...overrides
  };
}

describe('loadCatalogue', () => {
  let dir: string;
  const write = (content: unknown): string => {
    const path = join(dir, 'catalogue.json');
    writeFileSync(path, typeof content === 'string' ? content : JSON.stringify(content));
    return path;
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'catalogue-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads an operator's file, passing fields it does not read through and keeping aliases out", () => {
    const catalogue = loadCatalogue(write({ models: [entry({ line: 'operator' }), entry({ id: 'op-model-2', aliases: [] })] }));

    const { aliases: _aliases, ...served } = entry({ line: 'operator' });
    expect(catalogue.resolve('op')).toEqual(served);
    expect(catalogue.resolve('op-model-2')?.id).toBe('op-model-2');
  });

  it('accepts null capabilities and null limits', () => {
    const catalogue = loadCatalogue(write({ models: [entry({ capabilities: null, max_tokens: null, max_input_tokens: null })] }));

    expect(catalogue.resolve('op-model-1')).toEqual(expect.objectContaining({ capabilities: null, max_tokens: null }));
  });

  it('refuses a file it cannot read, naming the path', () => {
    const path = join(dir, 'missing.json');

    expect(() => loadCatalogue(path)).toThrow(`Cannot read the model catalogue ${path}`);
  });

  it('refuses a file that is not JSON, naming the path', () => {
    const path = write('{"models": [');

    expect(() => loadCatalogue(path)).toThrow(`Invalid model catalogue ${path}: not JSON`);
  });

  const withCapabilities = (change: (caps: Record<string, any>) => void) => {
    const caps = capabilities();
    change(caps);
    return { models: [entry({ capabilities: caps })] };
  };

  it.each([
    ['a top-level array', [entry()], 'the file must be an object with a "models" array'],
    ['no models', { models: [] }, 'models must list at least one model'],
    ['an entry that is not an object', { models: ['op'] }, 'models[0] must be an object'],
    ['a missing id', { models: [entry({ id: undefined })] }, 'models[0].id must be a non-empty string'],
    ['the wrong type', { models: [entry({ type: 'models' })] }, 'models[0].type must be "model"'],
    ['a missing display name', { models: [entry({ display_name: 3 })] }, 'models[0].display_name must be a string'],
    ['a date that is not RFC 3339', { models: [entry({ created_at: '2026-05-01' })] }, 'models[0].created_at must be an RFC 3339 date-time'],
    ['a zero max_tokens', { models: [entry({ max_tokens: 0 })] }, 'models[0].max_tokens must be a positive integer or null'],
    ['a fractional context window', { models: [entry({ max_input_tokens: 1.5 })] }, 'models[0].max_input_tokens must be a positive integer or null'],
    ['aliases that are not a list', { models: [entry({ aliases: 'op' })] }, 'models[0].aliases must be an array of non-empty strings'],
    ['an empty alias', { models: [entry({ aliases: [''] })] }, 'models[0].aliases must be an array of non-empty strings'],
    ['a missing capability', withCapabilities((caps) => delete caps['pdf_input']), 'models[0].capabilities.pdf_input must be an object'],
    ['a non-boolean support flag', withCapabilities((caps) => { caps['effort'].low.supported = 'yes'; }), 'models[0].capabilities.effort.low.supported must be a boolean'],
    ['a null where null is not allowed', withCapabilities((caps) => { caps['effort'].max = null; }), 'models[0].capabilities.effort.max must be an object'],
    ['a bad optional thinking type', withCapabilities((caps) => { caps['thinking'].types.disabled = true; }), 'models[0].capabilities.thinking.types.disabled must be an object'],
    ['missing thinking types', withCapabilities((caps) => { delete caps['thinking'].types; }), 'models[0].capabilities.thinking.types must be an object'],
    ['a name served twice', { models: [entry(), entry({ id: 'op-model-2', aliases: ['op-model-1'] })] }, 'models[1] names "op-model-1", which models[0] already serves']
  ])('refuses %s', (_case, content, problem) => {
    const path = write(content);

    expect(() => loadCatalogue(path)).toThrow(`Invalid model catalogue ${path}: ${problem}`);
  });
});
