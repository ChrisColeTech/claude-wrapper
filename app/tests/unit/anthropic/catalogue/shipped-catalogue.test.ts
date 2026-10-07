import { SHIPPED_CATALOGUE_PATH, loadCatalogue } from '../../../../src/anthropic/catalogue';

// The shipped catalogue's content, from spec section 3. Limits, names and release dates are the
// real API's for each model (platform.claude.com model pages, 2026-10-07); capabilities are
// honest to the surface: batch, code execution, context management and citations unsupported;
// image, PDF and structured outputs supported; effort and thinking as the real API reports them.
const no = { supported: false };
const yes = { supported: true };
const SURFACE = {
  batch: no,
  citations: no,
  code_execution: no,
  context_management: { supported: false, clear_thinking_20251015: no, clear_tool_uses_20250919: no, compact_20260112: no },
  image_input: yes,
  pdf_input: yes,
  structured_outputs: yes
};
const FIVE_X = {
  ...SURFACE,
  effort: { supported: true, low: yes, medium: yes, high: yes, xhigh: yes, max: yes },
  thinking: { supported: true, types: { adaptive: yes, enabled: no, disabled: no } }
};
const HAIKU = {
  ...SURFACE,
  effort: { supported: false, low: no, medium: no, high: no, xhigh: no, max: no },
  thinking: { supported: true, types: { adaptive: no, enabled: yes, disabled: yes } }
};
const model = (id: string, name: string, released: string, limits: [number, number], capabilities: object) => ({
  id,
  type: 'model',
  display_name: name,
  created_at: `${released}T00:00:00Z`,
  max_input_tokens: limits[0],
  max_tokens: limits[1],
  capabilities
});

const SONNET = model('claude-sonnet-5-5', 'Claude Sonnet 5.5', '2026-09-28', [1_000_000, 128_000], FIVE_X);
const OPUS = model('claude-opus-5-5', 'Claude Opus 5.5', '2026-09-22', [1_000_000, 128_000], FIVE_X);
const FABLE = model('claude-fable-5-1', 'Claude Fable 5.1', '2026-09-01', [1_000_000, 128_000], FIVE_X);
const HAIKU_4_5 = model('claude-haiku-4-5-20251001', 'Claude Haiku 4.5', '2025-10-15', [200_000, 64_000], HAIKU);

describe('the shipped catalogue', () => {
  const catalogue = loadCatalogue(SHIPPED_CATALOGUE_PATH);

  it('serves the four models newest first', () => {
    expect(catalogue.list({ limit: 20 })).toEqual({
      data: [SONNET, OPUS, FABLE, HAIKU_4_5],
      first_id: 'claude-sonnet-5-5',
      last_id: 'claude-haiku-4-5-20251001',
      has_more: false
    });
  });

  it.each([
    ['fable', 'claude-fable-5-1'],
    ['opus', 'claude-opus-5-5'],
    ['sonnet', 'claude-sonnet-5-5'],
    ['haiku', 'claude-haiku-4-5-20251001'],
    ['claude-haiku-4-5', 'claude-haiku-4-5-20251001']
  ])('resolves the alias %s to %s', (alias, id) => {
    expect(catalogue.resolve(alias)?.id).toBe(id);
  });

  it.each(['default', 'best', 'opusplan', 'sonnet[1m]', 'opus[1m]'])('does not serve the CLI-only alias %s', (alias) => {
    expect(catalogue.resolve(alias)).toBeNull();
  });
});
