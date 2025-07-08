import {
  MockExpressResponse,
  MockStreamingFormatter,
  MockStreamingManager,
  MockCoreWrapper,
  StreamingTestDataFactory
} from '../../mocks/streaming-mocks';

/**
 * Reusable test setup for streaming components
 */
export class StreamingTestSetup {
  public mockResponse: MockExpressResponse;
  public mockFormatter: MockStreamingFormatter;
  public mockManager: MockStreamingManager;
  public mockCoreWrapper: MockCoreWrapper;
  public testDataFactory: typeof StreamingTestDataFactory;

  constructor() {
    this.mockResponse = new MockExpressResponse();
    this.mockFormatter = new MockStreamingFormatter();
    this.mockManager = new MockStreamingManager();
    this.mockCoreWrapper = new MockCoreWrapper();
    this.testDataFactory = StreamingTestDataFactory;
  }

  /**
   * Reset all mocks before each test
   */
  beforeEach() {
    this.mockResponse.reset();
    this.mockFormatter.reset();
    this.mockManager.reset();
    this.mockCoreWrapper.reset();
  }

  /**
   * Cleanup after each test
   */
  afterEach() {
    // Cleanup any timers or resources
    this.mockManager.shutdown();
  }

  /**
   * Common test assertions
   */
  assertSSEFormat(content: string) {
    expect(content).toContain('data: ');
    expect(content).toContain('\n\n');
  }

  assertValidStreamingChunk(chunk: string) {
    expect(chunk.startsWith('data: ')).toBe(true);
    expect(chunk.endsWith('\n\n')).toBe(true);
    
    const dataContent = chunk.replace('data: ', '').replace('\n\n', '');
    if (dataContent !== '[DONE]') {
      expect(() => JSON.parse(dataContent)).not.toThrow();
    }
  }

  assertNoMemoryLeaks() {
    expect(this.mockManager.getActiveConnections()).toBe(0);
  }
}