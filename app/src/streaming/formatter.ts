export class StreamingFormatter {
  formatChunk(chunk: any): string {
    // TODO: Implement OpenAI streaming format
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  formatError(error: Error): string {
    return `data: {"error": "${error.message}"}\n\n`;
  }

  formatEnd(): string {
    return 'data: [DONE]\n\n';
  }
}