/**
 * The Anthropic surface's static OpenAPI document (spec section 17): served beside the OpenAI
 * surface's `/swagger.json`, public like it, and listed in the Swagger UI's definition picker at
 * `/docs`, whose existing definition is left as it is.
 */
import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import { swaggerSpec } from '../../../src/api/swagger';
import { SurfaceHarness, startSurface } from '../../mocks/anthropic/surface-harness';

const DOCUMENT_PATH = '/docs/anthropic-openapi.json';
const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'];

type OpenApiDocument = { openapi: string; paths: Record<string, Record<string, unknown>> };

/** Every operation in `document` as `METHOD /path`, sorted. */
const operations = (document: OpenApiDocument): string[] =>
  Object.entries(document.paths)
    .flatMap(([path, item]) => Object.keys(item).filter(key => METHODS.includes(key)).map(method => `${method.toUpperCase()} ${path}`))
    .sort();

describe('Anthropic surface: the OpenAPI document', () => {
  let surface: SurfaceHarness;

  beforeEach(async () => {
    surface = await startSurface();
  });

  afterEach(async () => {
    await surface.close();
  });

  it('serves an OpenAPI 3.0 document of the four endpoints', async () => {
    const response = await request(surface.baseURL).get(DOCUMENT_PATH).expect(200).expect('content-type', /application\/json/);

    expect(response.body.openapi).toMatch(/^3\.0\.\d+$/);
    expect(operations(response.body)).toEqual([
      'GET /v1/models',
      'GET /v1/models/{model_id}',
      'POST /v1/messages',
      'POST /v1/messages/count_tokens'
    ]);
  });

  it('is a valid OpenAPI 3.0 document whose every reference resolves', async () => {
    const document = (await request(surface.baseURL).get(DOCUMENT_PATH).expect(200)).body;

    await expect(SwaggerParser.validate(document)).resolves.toBeDefined();
  });

  describe('agrees with the surface on the body fields', () => {
    const HEADERS = { 'anthropic-version': '2023-06-01', 'anthropic-beta': 'mcp-client-2025-11-20' };
    const MESSAGES = [{ role: 'user', content: 'Hello' }];

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    /** The JSON body schema of `POST path`, references resolved. */
    async function bodySchema(path: string): Promise<{ properties: Record<string, unknown>; required: string[]; additionalProperties: unknown }> {
      const document = (await request(surface.baseURL).get(DOCUMENT_PATH).expect(200)).body;
      const resolved = await SwaggerParser.dereference(document) as unknown as {
        paths: Record<string, { post: { requestBody: { content: Record<string, { schema: never }> } } }>
      };
      return resolved.paths[path]!.post.requestBody.content['application/json']!.schema;
    }

    const post = (path: string, body: object) => request(surface.baseURL).post(path).set(HEADERS).send(body);

    it.each([
      ['/v1/messages', { model: 'haiku', max_tokens: 16, messages: MESSAGES }],
      ['/v1/messages/count_tokens', { model: 'haiku', messages: MESSAGES }]
    ])('%s: every field it lists is one the surface accepts, and it forbids the rest', async (path, required) => {
      const schema = await bodySchema(path);

      expect(schema.required.sort()).toEqual(Object.keys(required).sort());
      for (const field of Object.keys(schema.properties)) {
        const response = await post(path, { ...required, ...(field in required ? {} : { [field]: null }) });
        expect({ field, message: response.body.error?.message }).not.toEqual({ field, message: expect.stringContaining('Extra inputs') });
      }
      expect(schema.additionalProperties).toBe(false);
      const extra = await post(path, { ...required, not_in_the_document: 1 }).expect(400);
      expect(extra.body.error.message).toBe('not_in_the_document: Extra inputs are not permitted');
    });
  });

  describe('with API_KEY set', () => {
    beforeEach(() => {
      process.env['API_KEY'] = 'wrapper-key';
    });

    afterEach(() => {
      delete process.env['API_KEY'];
    });

    it('is public, like the OpenAI surface’s /swagger.json', async () => {
      await request(surface.baseURL).get(DOCUMENT_PATH).expect(200);
      await request(surface.baseURL).get(DOCUMENT_PATH).set('anthropic-version', '2023-06-01').expect(200);
    });
  });

  describe('the Swagger UI at /docs', () => {
    /** The options the UI starts with: `swagger-ui-express` writes them into its init script. */
    async function uiOptions(): Promise<{ swaggerDoc?: unknown; customOptions: { urls?: unknown } }> {
      const script = (await request(surface.baseURL).get('/docs/swagger-ui-init.js').expect(200)).text;
      const options = /var options = (\{[\s\S]*?\});\n/.exec(script);
      if (!options?.[1]) throw new Error('no options in the Swagger UI init script');
      return JSON.parse(options[1]);
    }

    it('offers both surfaces in its definition picker, the OpenAI one first', async () => {
      const options = await uiOptions();

      expect(options.customOptions.urls).toEqual([
        { url: '/swagger.json', name: 'OpenAI surface' },
        { url: DOCUMENT_PATH, name: 'Anthropic surface' }
      ]);
      expect(options.swaggerDoc).toBeUndefined(); // an inline definition would hide the picker's choice
    });

    it('shows the top bar that holds the picker', async () => {
      const page = (await request(surface.baseURL).get('/docs/').expect(200)).text;

      expect(page).not.toMatch(/\.topbar(\s+\.download-url-wrapper)?\s*\{\s*display:\s*none/);
    });

    it('still serves the OpenAI surface’s existing definition at /swagger.json', async () => {
      const response = await request(surface.baseURL).get('/swagger.json').expect(200);

      expect(response.body).toEqual(JSON.parse(JSON.stringify(swaggerSpec)));
      expect(response.body.paths).toHaveProperty(['/v1/chat/completions']);
    });
  });
});
