/**
 * Mock Claude client for testing
 * Provides predictable responses without actual API calls
 */

export interface MockClaudeResponse {
  content: string;
  stop_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class MockClaudeClient {
  private responses: MockClaudeResponse[] = [];
  private currentIndex = 0;
  private shouldError = false;
  private errorMessage = 'Mock error';

  constructor() {
    this.setDefaultResponses();
  }

  private setDefaultResponses(): void {
    this.responses = [
      {
        content: 'Hello! I am doing well, thank you for asking.',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 15 }
      },
      {
        content: 'The capital of France is Paris.',
        stop_reason: 'end_turn',
        usage: { input_tokens: 8, output_tokens: 7 }
      },
      {
        content: 'Paris has a population of approximately 2.16 million people in the city proper.',
        stop_reason: 'end_turn',
        usage: { input_tokens: 12, output_tokens: 18 }
      }
    ];
  }

  async sendMessage(message: string): Promise<MockClaudeResponse> {
    if (this.shouldError) {
      throw new Error(this.errorMessage);
    }

    const response = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return response;
  }

  async *streamMessage(message: string): AsyncGenerator<string, void, unknown> {
    if (this.shouldError) {
      throw new Error(this.errorMessage);
    }

    const response = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;
    
    // Simulate streaming by yielding words
    const words = response.content.split(' ');
    for (const word of words) {
      await new Promise(resolve => setTimeout(resolve, 5));
      yield word + ' ';
    }
  }

  // Test utilities
  setResponses(responses: MockClaudeResponse[]): void {
    this.responses = responses;
    this.currentIndex = 0;
  }

  setError(shouldError: boolean, message?: string): void {
    this.shouldError = shouldError;
    if (message) {
      this.errorMessage = message;
    }
  }

  reset(): void {
    this.currentIndex = 0;
    this.shouldError = false;
    this.errorMessage = 'Mock error';
    this.setDefaultResponses();
  }

  getCallCount(): number {
    return this.currentIndex;
  }
}
