/**
 * Images and documents reach upstream unchanged on both turn kinds (spec sections 4.3 and 5):
 * a base64 image, and documents with a base64 PDF, text or content source, `title`, `context`
 * and `citations: {enabled}` included. A first turn and a continued turn send the new message's
 * blocks as sent (less the ignored `cache_control`); a replayed turn renders the earlier turns'
 * media as real blocks inside the history. An answer carrying citations, echoed back as the
 * client got it, still continues its session.
 */
import { fingerprint, NormalisedMessage, planTurn, TurnPlan } from '../../../../src/anthropic/request';
import { Sessions } from '../../../../src/anthropic/sessions';
import { runContext, shippedCatalogue } from '../../../mocks/anthropic/plan-context';
import { memorySessions } from '../../../mocks/anthropic/sessions';

type Message = { role: 'user' | 'assistant'; content: object[] };

const text = (value: string) => ({ type: 'text', text: value });
const IMAGE = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } };
const PDF = {
  type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjQ=' },
  title: 'Tangerine', context: 'A one-page memo.', citations: { enabled: true }
};
const TEXT_DOCUMENT = {
  type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'The codeword is saffron-5' },
  title: 'Saffron memo', context: 'An internal memo.', citations: { enabled: true }
};
const CONTENT_DOCUMENT = {
  type: 'document', source: { type: 'content', content: [text('The codeword is cobalt-9')] }, citations: { enabled: true }
};
const CITATION = {
  type: 'char_location', cited_text: 'The codeword is saffron-5', document_index: 1,
  document_title: 'Saffron memo', start_char_index: 0, end_char_index: 25
};

const U1: Message = { role: 'user', content: [IMAGE, TEXT_DOCUMENT, text('What is the codeword?')] };
const A1: Message = { role: 'assistant', content: [text('The memo says '), { ...text('The codeword is saffron-5'), citations: [CITATION] }] };

describe('planTurn: images and documents', () => {
  let sessions: Sessions;

  const plan = (...messages: Message[]) =>
    planTurn({ model: 'fable', max_tokens: 1024, messages }, shippedCatalogue, sessions, runContext()) as TurnPlan;

  beforeEach(() => {
    sessions = memorySessions().sessions;
  });

  it("sends a first turn's media verbatim, every document field kept, cache_control dropped", () => {
    const result = plan({ role: 'user', content: [{ ...IMAGE, cache_control: { type: 'ephemeral' } }, PDF, CONTENT_DOCUMENT,
      text('Summarise them.')] });

    expect(result.continuation).toEqual({
      replay: { role: 'user', content: [IMAGE, PDF, CONTENT_DOCUMENT, text('Summarise them.')] }
    });
  });

  it('continues after a turn with media and an answer with citations, sending the new media verbatim', () => {
    sessions.record('session-1', fingerprint([U1, A1] as NormalisedMessage[]));
    const tail: Message = { role: 'user', content: [PDF, text('And this one?')] };

    const result = plan(U1, A1, tail);

    expect(result.continuation).toEqual({ resume: 'session-1', message: tail });
  });

  it("replays media in earlier turns as real blocks, the final message's verbatim", () => {
    const result = plan(U1, A1, { role: 'user', content: [CONTENT_DOCUMENT, text('And this one?')] });

    expect(result.continuation).toEqual({
      replay: {
        role: 'user',
        content: [
          { type: 'text', text: '<conversation_history>\n' +
            'These are the earlier turns of this conversation, and the assistant turns in it are your own replies.\n' +
            '<turn role="user">\n' },
          IMAGE,
          TEXT_DOCUMENT,
          { type: 'text', text: '\nWhat is the codeword?\n</turn>\n' +
            '<turn role="assistant">\nThe memo says \nThe codeword is saffron-5\n</turn>\n</conversation_history>' },
          CONTENT_DOCUMENT,
          text('And this one?')
        ]
      }
    });
  });
});
