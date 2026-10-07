/**
 * Citations in the turn stream (spec sections 4.3 and 11): a document's citation reaches the
 * client only as a `citations_delta`, so the translator relays it, and the field allowlist keeps
 * each citation type's fields as the Messages API defines them (the official SDK's `Citation*`
 * types), dropping and logging anything else, as for every other event, block and delta.
 */
import { ApiEvent } from '../../../../src/anthropic/translate';
import { BLOCK_STOP, END_TURN, MESSAGE_START, MESSAGE_STOP, streamEvent, TEXT_START, textDelta, translate }
  from '../../../mocks/anthropic/turn-frames';

const CITATIONS: { [type: string]: object } = {
  char_location: { type: 'char_location', cited_text: 'The codeword is saffron-5', document_index: 0,
    document_title: 'Saffron memo', start_char_index: 0, end_char_index: 25, file_id: null },
  page_location: { type: 'page_location', cited_text: 'The codeword is tangerine-7', document_index: 1,
    document_title: null, start_page_number: 1, end_page_number: 2, file_id: null },
  content_block_location: { type: 'content_block_location', cited_text: 'The codeword is cobalt-9', document_index: 2,
    document_title: 'Cobalt', start_block_index: 0, end_block_index: 1, file_id: null },
  search_result_location: { type: 'search_result_location', cited_text: 'Result.', search_result_index: 0,
    source: 'https://example.com', title: 'Example', start_block_index: 0, end_block_index: 1 },
  web_search_result_location: { type: 'web_search_result_location', cited_text: 'Page text.', encrypted_index: 'Eo8B',
    title: 'Example', url: 'https://example.com/page' }
};

const citationDelta = (citation: object) => ({ type: 'content_block_delta', index: 0, delta: { type: 'citations_delta', citation } });

function turnWith(citation: object, debug: jest.Mock = jest.fn()): ApiEvent[] {
  const start = { ...TEXT_START, content_block: { ...TEXT_START.content_block, citations: [] } };
  const frames = [MESSAGE_START, start, citationDelta(citation), textDelta('saffron-5'), BLOCK_STOP, END_TURN, MESSAGE_STOP];
  return translate(frames.map(event => streamEvent(event)), debug) as ApiEvent[];
}

describe('translator: citations', () => {
  it.each(Object.keys(CITATIONS))('relays a %s citation with every field the API defines', (type) => {
    const events = turnWith(CITATIONS[type] as object);

    expect(events[1]).toEqual({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: [] } });
    expect(events[2]).toEqual(citationDelta(CITATIONS[type] as object));
  });

  it('drops and logs a citation field the API does not define', () => {
    const debug = jest.fn();

    const events = turnWith({ ...CITATIONS['char_location'], estimated_tokens: 7 }, debug);

    expect(events[2]).toEqual(citationDelta(CITATIONS['char_location'] as object));
    expect(debug).toHaveBeenCalledWith('Field dropped from the turn stream',
      { field: 'content_block_delta.delta.citation.estimated_tokens' });
  });
});
