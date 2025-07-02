/**
 * Sample request fixtures for testing
 * Based on OpenAI Chat Completions API format
 */

export const sampleChatRequest = {
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    {
      role: 'user',
      content: 'Hello, world!'
    }
  ],
  stream: false,
  temperature: 1.0
};

export const sampleStreamingRequest = {
  ...sampleChatRequest,
  stream: true
};

export const sampleToolsRequest = {
  ...sampleChatRequest,
  enable_tools: true
};
