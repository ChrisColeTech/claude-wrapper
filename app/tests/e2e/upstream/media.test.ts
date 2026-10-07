/**
 * E2E (real CLI, behind UPSTREAM_E2E=1): images and documents reach the model (spec sections
 * 4.3 and 5). One base64 image (a solid orange square, built here) and one base64 PDF (the
 * one-page `o-pass-through.tangerine.pdf` fixture, whose only text is "The codeword is
 * tangerine-7"), first in the message itself, then in an earlier turn of a replayed turn, where
 * the surface renders them as real blocks inside the history. The model names the colour and
 * quotes the codeword both times. Two runs, on the cheapest catalogued model by default.
 *
 *   UPSTREAM_E2E=1 npm --prefix app run test:e2e -- tests/e2e/upstream/media.test.ts
 */
import type Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { createSpawnRunner, Runner, RunSpec } from '../../../src/upstream/runner';
import { openStateDirectory, StateDirectory } from '../../../src/upstream/state-directory';
import type { SurfaceHarness } from '../../mocks/anthropic/surface-harness';
import { waitFor } from '../../mocks/shared/wait-for';
import { UPSTREAM_FIXTURES } from '../../mocks/upstream/recordings';
import { describeUpstream, E2E_MODEL, productionSurface, removeStateRoot } from './harness';

const RUN_EXIT_WAIT_MS = 60_000;
const ASK = 'Reply in one line: the colour of the image, then the codeword in the PDF.';

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])));
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, crc]);
}

/** A `size` x `size` PNG of one RGB colour. */
function solidPng(size: number, rgb: [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: size }, () => rgb).flat())]);
  const pixels = zlib.deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))]);
}

const IMAGE: Anthropic.ImageBlockParam = {
  type: 'image', source: { type: 'base64', media_type: 'image/png', data: solidPng(64, [255, 128, 0]).toString('base64') }
};
const PDF: Anthropic.DocumentBlockParam = {
  type: 'document',
  source: { type: 'base64', media_type: 'application/pdf',
    data: fs.readFileSync(path.join(UPSTREAM_FIXTURES, 'cli-probes', 'o-pass-through.tangerine.pdf')).toString('base64') }
};

const textOf = (message: Anthropic.Message): string =>
  message.content.filter(block => block.type === 'text').map(block => (block as Anthropic.TextBlock).text).join('');

/** The production spawn runner, noting each run's spec (never logged: it carries the environment). */
function notingRunner(specs: RunSpec[]): Runner {
  const runner = createSpawnRunner();
  return { startRun: spec => { specs.push(spec); return runner.startRun(spec); } };
}

describeUpstream('images and documents against the real CLI', () => {
  let root: string;
  let state: StateDirectory;
  let surface: SurfaceHarness;
  let specs: RunSpec[];

  const runsExited = () => waitFor(() => fs.readdirSync(state.runs).length === 0, RUN_EXIT_WAIT_MS);

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'media-e2e-'));
    state = openStateDirectory(root);
    specs = [];
    surface = await productionSurface(state, { runner: notingRunner(specs) });
  });

  afterEach(async () => {
    await runsExited();
    await surface.close();
    removeStateRoot(root, state.cwd);
  }, RUN_EXIT_WAIT_MS + 10_000);

  it('reads an image and a PDF sent in the message', async () => {
    const message = await surface.client().messages.create({
      model: E2E_MODEL, max_tokens: 256, messages: [{ role: 'user', content: [IMAGE, PDF, { type: 'text', text: ASK }] }]
    });

    expect(textOf(message).toLowerCase()).toContain('orange');
    expect(textOf(message)).toContain('tangerine-7');
  }, 120_000);

  it('reads them from an earlier turn of a replayed turn, rendered as real blocks in the history', async () => {
    const message = await surface.client().messages.create({
      model: E2E_MODEL, max_tokens: 256, messages: [
        { role: 'user', content: [IMAGE, PDF, { type: 'text', text: 'Keep these two attachments for my next question.' }] },
        { role: 'assistant', content: 'Kept.' },
        { role: 'user', content: `About the attachments in my earlier message. ${ASK}` }
      ]
    });

    expect(specs[0]?.flags).not.toContain('--resume');
    expect(textOf(message).toLowerCase()).toContain('orange');
    expect(textOf(message)).toContain('tangerine-7');
  }, 120_000);
});
