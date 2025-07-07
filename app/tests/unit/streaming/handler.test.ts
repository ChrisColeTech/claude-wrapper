import { StreamingHandler } from '../../../src/streaming/handler';

describe('StreamingHandler', () => {
  let handler: StreamingHandler;

  beforeEach(() => {
    handler = new StreamingHandler();
  });

  it('should create instance', () => {
    expect(handler).toBeInstanceOf(StreamingHandler);
  });
});