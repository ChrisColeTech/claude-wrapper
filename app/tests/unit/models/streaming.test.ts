/**
 * Unit tests for Streaming Response Models
 * Tests src/models/streaming.ts components
 * Based on Python models.py:131-143 validation patterns
 */

import { 
  StreamChoiceSchema,
  ChatCompletionStreamResponseSchema,
  StreamDeltaTypes,
  StreamingUtils,
  type StreamChoice,
  type ChatCompletionStreamResponse
} from '../../../src/models/streaming';
import { 
  StreamingError,
  ClaudeClientError 
} from '../../../src/models/error';

describe('Streaming Response Models', () => {
  describe('StreamChoiceSchema', () => {
    it('should validate valid stream choice', () => {
      const choice = {
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null
      };
      
      const result = StreamChoiceSchema.parse(choice);
      expect(result.index).toBe(0);
      expect(result.delta.role).toBe("assistant");
      expect(result.finish_reason).toBeNull();
    });

    it('should validate choice with content delta', () => {
      const choice = {
        index: 0,
        delta: { content: "Hello world" }
      };
      
      const result = StreamChoiceSchema.parse(choice);
      expect(result.delta.content).toBe("Hello world");
      expect(result.finish_reason).toBeUndefined();
    });

    it('should validate choice with finish_reason', () => {
      const choice = {
        index: 0,
        delta: {},
        finish_reason: "stop"
      };
      
      const result = StreamChoiceSchema.parse(choice);
      expect(result.finish_reason).toBe("stop");
    });

    it('should reject negative index', () => {
      const choice = {
        index: -1,
        delta: {}
      };
      
      expect(() => StreamChoiceSchema.parse(choice)).toThrow();
    });

    it('should reject invalid finish_reason', () => {
      const choice = {
        index: 0,
        delta: {},
        finish_reason: "invalid_reason"
      };
      
      expect(() => StreamChoiceSchema.parse(choice)).toThrow();
    });
  });

  describe('ChatCompletionStreamResponseSchema', () => {
    const baseStreamResponse = {
      model: "claude-3-5-sonnet-20241022",
      choices: [{
        index: 0,
        delta: { role: "assistant" }
      }]
    };

    it('should validate stream response with defaults', () => {
      const result = ChatCompletionStreamResponseSchema.parse(baseStreamResponse);
      
      expect(result.object).toBe("chat.completion.chunk");
      expect(result.id).toMatch(/^chatcmpl-[a-z0-9]{8}$/);
      expect(result.created).toBeGreaterThan(0);
      expect(result.model).toBe("claude-3-5-sonnet-20241022");
      expect(result.choices).toHaveLength(1);
    });

    it('should validate stream response with system_fingerprint', () => {
      const responseWithFingerprint = {
        ...baseStreamResponse,
        system_fingerprint: "fp_stream123"
      };
      
      const result = ChatCompletionStreamResponseSchema.parse(responseWithFingerprint);
      expect(result.system_fingerprint).toBe("fp_stream123");
    });

    it('should validate stream response with multiple choices', () => {
      const responseWithMultipleChoices = {
        ...baseStreamResponse,
        choices: [
          { index: 0, delta: { role: "assistant" } },
          { index: 1, delta: { content: "Alternative response" } }
        ]
      };
      
      const result = ChatCompletionStreamResponseSchema.parse(responseWithMultipleChoices);
      expect(result.choices).toHaveLength(2);
    });
  });

  describe('StreamDeltaTypes', () => {
    describe('role', () => {
      it('should create role delta', () => {
        const delta = StreamDeltaTypes.role("assistant");
        expect(delta).toEqual({ role: "assistant" });
      });
    });

    describe('content', () => {
      it('should create content delta', () => {
        const delta = StreamDeltaTypes.content("Hello world");
        expect(delta).toEqual({ content: "Hello world" });
      });

      it('should handle empty content', () => {
        const delta = StreamDeltaTypes.content("");
        expect(delta).toEqual({ content: "" });
      });
    });

    describe('empty', () => {
      it('should create empty delta', () => {
        const delta = StreamDeltaTypes.empty();
        expect(delta).toEqual({});
      });
    });
  });

  describe('StreamingUtils', () => {
    const testId = "chatcmpl-test123";
    const testModel = "claude-3-5-sonnet-20241022";

    describe('createInitialChunk', () => {
      it('should create initial chunk with role', () => {
        const chunk = StreamingUtils.createInitialChunk(testId, testModel);
        
        expect(chunk.id).toBe(testId);
        expect(chunk.model).toBe(testModel);
        expect(chunk.object).toBe("chat.completion.chunk");
        expect(chunk.choices[0].delta.role).toBe("assistant");
        expect(chunk.choices[0].finish_reason).toBeNull();
      });

      it('should create initial chunk with custom role', () => {
        const chunk = StreamingUtils.createInitialChunk(testId, testModel, "assistant");
        
        expect(chunk.choices[0].delta.role).toBe("assistant");
      });
    });

    describe('createContentChunk', () => {
      it('should create content chunk', () => {
        const chunk = StreamingUtils.createContentChunk(testId, testModel, "Hello");
        
        expect(chunk.id).toBe(testId);
        expect(chunk.model).toBe(testModel);
        expect(chunk.choices[0].delta.content).toBe("Hello");
        expect(chunk.choices[0].finish_reason).toBeNull();
      });

      it('should handle empty content', () => {
        const chunk = StreamingUtils.createContentChunk(testId, testModel, "");
        
        expect(chunk.choices[0].delta.content).toBe("");
      });
    });

    describe('createFinalChunk', () => {
      it('should create final chunk with default finish_reason', () => {
        const chunk = StreamingUtils.createFinalChunk(testId, testModel);
        
        expect(chunk.id).toBe(testId);
        expect(chunk.model).toBe(testModel);
        expect(chunk.choices[0].delta).toEqual({});
        expect(chunk.choices[0].finish_reason).toBe("stop");
      });

      it('should create final chunk with custom finish_reason', () => {
        const chunk = StreamingUtils.createFinalChunk(testId, testModel, "length");
        
        expect(chunk.choices[0].finish_reason).toBe("length");
      });
    });

    describe('createStreamFromContent', () => {
      it('should create stream from content', () => {
        const content = "Hello world! This is a test.";
        const chunks = Array.from(
          StreamingUtils.createStreamFromContent(content, testModel, 5)
        );
        
        // Should have initial + content chunks + final
        expect(chunks.length).toBeGreaterThan(3);
        
        // First chunk should have role
        expect(chunks[0].choices[0].delta.role).toBe("assistant");
        
        // Last chunk should have finish_reason
        const lastChunk = chunks[chunks.length - 1];
        expect(lastChunk.choices[0].finish_reason).toBe("stop");
        
        // Reconstruct content from chunks
        const reconstructed = chunks
          .slice(1, -1) // Skip initial and final chunks
          .map(chunk => chunk.choices[0].delta.content)
          .join("");
        
        expect(reconstructed).toBe(content);
      });

      it('should handle empty content', () => {
        const chunks = Array.from(
          StreamingUtils.createStreamFromContent("", testModel)
        );
        
        // Should have initial + final chunks only
        expect(chunks).toHaveLength(2);
        expect(chunks[0].choices[0].delta.role).toBe("assistant");
        expect(chunks[1].choices[0].finish_reason).toBe("stop");
      });

      it('should handle single character content', () => {
        const chunks = Array.from(
          StreamingUtils.createStreamFromContent("A", testModel)
        );
        
        expect(chunks).toHaveLength(3); // initial + content + final
        expect(chunks[1].choices[0].delta.content).toBe("A");
      });
    });

    describe('toSSE', () => {
      it('should convert chunk to SSE format', () => {
        const chunk = StreamingUtils.createContentChunk(testId, testModel, "Hello");
        const sse = StreamingUtils.toSSE(chunk);
        
        expect(sse).toMatch(/^data: /);
        expect(sse).toContain('"object":"chat.completion.chunk"');
        expect(sse).toContain('"content":"Hello"');
        expect(sse.endsWith('\n\n')).toBe(true);
      });

      it('should handle chunks with special characters', () => {
        const chunk = StreamingUtils.createContentChunk(testId, testModel, 'Special chars: "quotes" & newlines\n');
        const sse = StreamingUtils.toSSE(chunk);
        
        expect(sse).toMatch(/^data: /);
        expect(sse.endsWith('\n\n')).toBe(true);
        
        // Parse the JSON to ensure it's valid
        const jsonStr = sse.replace(/^data: /, '').replace(/\n\n$/, '');
        expect(() => JSON.parse(jsonStr)).not.toThrow();
      });
    });

    describe('createDoneEvent', () => {
      it('should create done event', () => {
        const doneEvent = StreamingUtils.createDoneEvent();
        
        expect(doneEvent).toBe("data: [DONE]\n\n");
      });
    });

    describe('validateStreamResponse', () => {
      it('should validate valid stream response', () => {
        const response = {
          model: testModel,
          choices: [{
            index: 0,
            delta: { content: "Hello" }
          }]
        };
        
        const result = StreamingUtils.validateStreamResponse(response);
        expect(result.model).toBe(testModel);
      });

      it('should throw on invalid stream response', () => {
        const invalidResponse = {
          model: testModel
          // missing choices
        };
        
        expect(() => StreamingUtils.validateStreamResponse(invalidResponse)).toThrow();
      });
    });
  });

  describe('Error Classes', () => {
    describe('StreamingError', () => {
      it('should create streaming error', () => {
        const error = new StreamingError("Test error");
        
        expect(error.message).toBe("Test error");
        expect(error.code).toBe("STREAMING_FAILED");
        expect(error.name).toBe("ClaudeClientError");
        expect(error).toBeInstanceOf(Error);
      });

      it('should create streaming error without code', () => {
        const error = new StreamingError("Test error");
        
        expect(error.message).toBe("Test error");
        expect(error.code).toBe("STREAMING_FAILED");
      });
    });

    describe('ClaudeClientError', () => {
      it('should create general Claude client error', () => {
        const error = new ClaudeClientError("General error", "TEST_CODE");
        
        expect(error.message).toBe("General error");
        expect(error.code).toBe("TEST_CODE");
        expect(error.name).toBe("ClaudeClientError");
        expect(error).toBeInstanceOf(Error);
      });
    });
  });

  describe('Integration tests', () => {
    it('should work with complete streaming workflow', () => {
      const content = "This is a test response from Claude.";
      const model = "claude-3-5-sonnet-20241022";
      
      // Generate stream chunks
      const chunks = Array.from(
        StreamingUtils.createStreamFromContent(content, model, 10)
      );
      
      // Validate each chunk
      for (const chunk of chunks) {
        expect(() => StreamingUtils.validateStreamResponse(chunk)).not.toThrow();
      }
      
      // Convert to SSE format
      const sseChunks = chunks.map(chunk => StreamingUtils.toSSE(chunk));
      const doneEvent = StreamingUtils.createDoneEvent();
      
      // All SSE chunks should be valid
      for (const sseChunk of sseChunks) {
        expect(sseChunk).toMatch(/^data: /);
        expect(sseChunk.endsWith('\n\n')).toBe(true);
      }
      
      expect(doneEvent).toBe("data: [DONE]\n\n");
      
      // Reconstruct original content
      const contentChunks = chunks
        .slice(1, -1) // Skip initial and final
        .map(chunk => chunk.choices[0].delta.content || "");
      
      const reconstructed = contentChunks.join("");
      expect(reconstructed).toBe(content);
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = [
        "", // empty content
        "A", // single character
        "🚀 Unicode content with emojis 🎉", // unicode
        "Line 1\nLine 2\nLine 3", // multiline
        '"Quoted content" with special chars: & < > \'', // special characters
      ];
      
      for (const content of edgeCases) {
        const chunks = Array.from(
          StreamingUtils.createStreamFromContent(content, "test-model")
        );
        
        // Should always have at least initial and final chunks
        expect(chunks.length).toBeGreaterThanOrEqual(2);
        
        // All chunks should be valid
        for (const chunk of chunks) {
          expect(() => StreamingUtils.validateStreamResponse(chunk)).not.toThrow();
        }
        
        // Should be able to convert to SSE
        for (const chunk of chunks) {
          expect(() => StreamingUtils.toSSE(chunk)).not.toThrow();
        }
      }
    });
  });
});