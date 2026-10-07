import Anthropic from '@anthropic-ai/sdk';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { createServer } from '../../../src/api/server';
import { createCatalogue } from '../../../src/anthropic/catalogue';
import { REQUEST_ID, SurfaceHarness, envelopeOf, rejectionOf, startSurface } from '../../mocks/anthropic/surface-harness';

const NEWEST_FIRST = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1', 'claude-haiku-4-5-20251001'];
const OPENAI_MODELS =
  '{"object":"list","data":[{"id":"sonnet","object":"model","owned_by":"anthropic","created":1709164800},' +
  '{"id":"opus","object":"model","owned_by":"anthropic","created":1709164800}]}';

function operatorEntry(id: string, aliases: string[]) {
  return {
    id,
    type: 'model' as const,
    display_name: `Operator ${id}`,
    created_at: '2026-01-01T00:00:00Z',
    max_input_tokens: 10_000,
    max_tokens: 1_000,
    capabilities: null,
    aliases
  };
}

describe('Anthropic surface: GET /v1/models and /v1/models/{id}', () => {
  let surface: SurfaceHarness;

  beforeEach(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    surface = await startSurface();
  });

  afterEach(async () => {
    await surface.close();
  });

  describe('models.list', () => {
    it('lists the catalogue newest first in one page', async () => {
      const page = await surface.client().models.list();

      expect(page.data.map((model) => model.id)).toEqual(NEWEST_FIRST);
      expect(page.first_id).toBe('claude-sonnet-5-5');
      expect(page.last_id).toBe('claude-haiku-4-5-20251001');
      expect(page.has_more).toBe(false);
      expect(page.data[0]).toEqual(expect.objectContaining({
        type: 'model', display_name: 'Claude Sonnet 5.5', max_input_tokens: 1_000_000, max_tokens: 128_000
      }));
      expect(page.data[0]).not.toHaveProperty('aliases');
    });

    it('carries a request id', async () => {
      const { response } = await surface.client().models.list().withResponse();

      expect(response.headers.get('request-id')).toMatch(REQUEST_ID);
    });

    it('auto-paginates to the end with a small limit', async () => {
      const ids: string[] = [];
      for await (const model of surface.client().models.list({ limit: 1 })) {
        ids.push(model.id);
      }

      expect(ids).toEqual(NEWEST_FIRST);
    });

    it('pages backward from before_id', async () => {
      const page = await surface.client().models.list({ before_id: 'claude-haiku-4-5-20251001', limit: 2 });

      expect(page.data.map((model) => model.id)).toEqual(['claude-opus-5-5', 'claude-fable-5-1']);
      expect(page.has_more).toBe(true);
    });

    it.each([0, 1001])('rejects limit %d with BadRequestError', async (limit) => {
      const error = await rejectionOf(surface.client().models.list({ limit }));

      expect(error).toBeInstanceOf(Anthropic.BadRequestError);
      expect(envelopeOf(error).error).toEqual({
        type: 'invalid_request_error', message: 'limit: must be an integer from 1 to 1000'
      });
    });

    it('rejects a limit that is not a number', async () => {
      const error = await rejectionOf(surface.client().get('/v1/models', { query: { limit: 'ten' } }));

      expect(error).toBeInstanceOf(Anthropic.BadRequestError);
    });

    it('rejects a cursor given twice', async () => {
      const response = await request(createServer())
        .get('/v1/models?after_id=claude-opus-5-5&after_id=claude-fable-5-1')
        .set('anthropic-version', '2023-06-01')
        .expect(400);

      expect(response.body.error).toEqual({ type: 'invalid_request_error', message: 'after_id: must be a single model id' });
    });

    it.each(['after_id', 'before_id'])('rejects a %s naming no model with BadRequestError', async (cursor) => {
      const error = await rejectionOf(surface.client().models.list({ [cursor]: 'claude-nope' }));

      expect(error).toBeInstanceOf(Anthropic.BadRequestError);
      expect(envelopeOf(error).error.message).toBe(`${cursor}: no model "claude-nope" in the catalogue`);
    });
  });

  describe('models.retrieve', () => {
    it('returns the entry for a canonical id', async () => {
      const page = await surface.client().models.list();
      const model = await surface.client().models.retrieve('claude-opus-5-5');

      expect(model).toEqual(page.data[1]);
    });

    it.each([
      ['sonnet', 'claude-sonnet-5-5'],
      ['claude-haiku-4-5', 'claude-haiku-4-5-20251001']
    ])('resolves the alias %s to the entry under %s', async (alias, id) => {
      const model = await surface.client().models.retrieve(alias);

      expect(model.id).toBe(id);
    });

    it('answers an unknown model with NotFoundError in the Anthropic envelope', async () => {
      const error = await rejectionOf(surface.client().models.retrieve('claude-nope'));

      expect(error).toBeInstanceOf(Anthropic.NotFoundError);
      expect(error.requestID).toMatch(REQUEST_ID);
      expect(error.error).toEqual({
        type: 'error',
        error: { type: 'not_found_error', message: 'model: claude-nope' },
        request_id: error.requestID
      });
    });
  });

  describe('the catalogue it serves', () => {
    let dir: string;

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'catalogue-'));
    });

    afterEach(() => {
      delete process.env['CLAUDE_WRAPPER_CATALOGUE_PATH'];
      rmSync(dir, { recursive: true, force: true });
    });

    it("serves the operator's catalogue from CLAUDE_WRAPPER_CATALOGUE_PATH", async () => {
      const path = join(dir, 'models.json');
      writeFileSync(path, JSON.stringify({ models: [operatorEntry('op-model-1', ['op'])] }));
      process.env['CLAUDE_WRAPPER_CATALOGUE_PATH'] = path;
      const operator = await startSurface();

      try {
        const page = await operator.client().models.list();
        expect(page.data.map((model) => model.id)).toEqual(['op-model-1']);
        expect((await operator.client().models.retrieve('op')).id).toBe('op-model-1');
      } finally {
        await operator.close();
      }
    });

    it('refuses to build the app on a catalogue that does not check out', () => {
      const path = join(dir, 'models.json');
      writeFileSync(path, JSON.stringify({ models: [] }));
      process.env['CLAUDE_WRAPPER_CATALOGUE_PATH'] = path;

      expect(() => createServer()).toThrow(`Invalid model catalogue ${path}`);
    });

    it('serves an injected catalogue', async () => {
      const injected = await startSurface({ catalogue: createCatalogue([operatorEntry('injected-1', [])]) });

      try {
        const page = await injected.client().models.list();
        expect(page.data.map((model) => model.id)).toEqual(['injected-1']);
      } finally {
        await injected.close();
      }
    });
  });

  describe('without anthropic-version', () => {
    it('leaves GET /v1/models to the OpenAI listing, byte for byte', async () => {
      const response = await request(createServer()).get('/v1/models').expect(200);

      expect(response.text).toBe(OPENAI_MODELS);
      expect(response.headers['request-id']).toBeUndefined();
    });

    it('leaves GET /v1/models/{id} unserved, as before', async () => {
      const response = await request(createServer()).get('/v1/models/sonnet').expect(404);

      expect(response.headers['content-type']).toMatch(/^text\/html/);
      expect(response.headers['request-id']).toBeUndefined();
    });
  });
});
