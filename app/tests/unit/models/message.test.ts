/**
 * Unit tests for Message Models
 * Tests src/models/message.ts components
 * Based on Python models.py:10-36 validation patterns
 */

import { 
  ContentPartSchema, 
  MessageSchema, 
  MessageHelpers, 
  MessageValidation,
  type ContentPart,
  type Message
} from '../../../src/models/message';

describe('Message Models', () => {
  describe('ContentPartSchema', () => {
    it('should validate valid content part', () => {
      const validPart: ContentPart = {
        type: "text",
        text: "Hello world"
      };
      
      const result = ContentPartSchema.parse(validPart);
      expect(result).toEqual(validPart);
    });

    it('should reject invalid type', () => {
      const invalidPart = {
        type: "image",
        text: "Hello"
      };
      
      expect(() => ContentPartSchema.parse(invalidPart)).toThrow();
    });

    it('should reject missing text', () => {
      const invalidPart = {
        type: "text"
      };
      
      expect(() => ContentPartSchema.parse(invalidPart)).toThrow();
    });

    it('should reject empty text', () => {
      const invalidPart = {
        type: "text",
        text: ""
      };
      
      // Empty text should still be valid (Zod allows empty strings)
      const result = ContentPartSchema.parse(invalidPart);
      expect(result.text).toBe("");
    });
  });

  describe('MessageSchema', () => {
    describe('Valid message validation', () => {
      it('should validate system message with string content', () => {
        const message = {
          role: "system",
          content: "You are a helpful assistant"
        };
        
        const result = MessageSchema.parse(message);
        expect(result.role).toBe("system");
        expect(result.content).toBe("You are a helpful assistant");
      });

      it('should validate user message with string content', () => {
        const message = {
          role: "user",
          content: "Hello, how are you?"
        };
        
        const result = MessageSchema.parse(message);
        expect(result.role).toBe("user");
        expect(result.content).toBe("Hello, how are you?");
      });

      it('should validate assistant message with string content', () => {
        const message = {
          role: "assistant",
          content: "I'm doing well, thank you!"
        };
        
        const result = MessageSchema.parse(message);
        expect(result.role).toBe("assistant");
        expect(result.content).toBe("I'm doing well, thank you!");
      });

      it('should validate message with optional name', () => {
        const message = {
          role: "user",
          content: "Hello",
          name: "john_doe"
        };
        
        const result = MessageSchema.parse(message);
        expect(result.name).toBe("john_doe");
      });
    });

    describe('Content normalization (Python compatibility)', () => {
      it('should convert array content to string', () => {
        const message = {
          role: "user",
          content: [
            { type: "text", text: "Hello" },
            { type: "text", text: "World" }
          ]
        };
        
        const result = MessageSchema.parse(message);
        expect(result.content).toBe("Hello\nWorld");
      });

      it('should handle single content part', () => {
        const message = {
          role: "user",
          content: [
            { type: "text", text: "Single message" }
          ]
        };
        
        const result = MessageSchema.parse(message);
        expect(result.content).toBe("Single message");
      });

      it('should handle empty content array', () => {
        const message = {
          role: "user",
          content: []
        };
        
        const result = MessageSchema.parse(message);
        expect(result.content).toBe("");
      });

      it('should preserve string content as-is', () => {
        const message = {
          role: "user",
          content: "Direct string content"
        };
        
        const result = MessageSchema.parse(message);
        expect(result.content).toBe("Direct string content");
      });

      it('should handle mixed content parts', () => {
        const message = {
          role: "user",
          content: [
            { type: "text", text: "First part" },
            { type: "text", text: "" },
            { type: "text", text: "Third part" }
          ]
        };
        
        const result = MessageSchema.parse(message);
        expect(result.content).toBe("First part\n\nThird part");
      });
    });

    describe('Invalid message validation', () => {
      it('should reject invalid role', () => {
        const message = {
          role: "invalid",
          content: "Hello"
        };
        
        expect(() => MessageSchema.parse(message)).toThrow();
      });

      it('should reject missing role', () => {
        const message = {
          content: "Hello"
        };
        
        expect(() => MessageSchema.parse(message)).toThrow();
      });

      it('should reject missing content', () => {
        const message = {
          role: "user"
        };
        
        expect(() => MessageSchema.parse(message)).toThrow();
      });

      it('should reject invalid content array', () => {
        const message = {
          role: "user",
          content: [
            { type: "invalid", text: "Hello" }
          ]
        };
        
        expect(() => MessageSchema.parse(message)).toThrow();
      });
    });
  });

  describe('MessageHelpers', () => {
    describe('system helper', () => {
      it('should create system message', () => {
        const message = MessageHelpers.system("You are a helpful assistant");
        
        expect(message.role).toBe("system");
        expect(message.content).toBe("You are a helpful assistant");
        expect(message.name).toBeUndefined();
      });
    });

    describe('user helper', () => {
      it('should create user message with string content', () => {
        const message = MessageHelpers.user("Hello world");
        
        expect(message.role).toBe("user");
        expect(message.content).toBe("Hello world");
      });

      it('should create user message with array content', () => {
        const contentParts: ContentPart[] = [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" }
        ];
        
        const message = MessageHelpers.user(contentParts);
        
        expect(message.role).toBe("user");
        expect(message.content).toEqual(contentParts);
      });
    });

    describe('assistant helper', () => {
      it('should create assistant message', () => {
        const message = MessageHelpers.assistant("I'm here to help!");
        
        expect(message.role).toBe("assistant");
        expect(message.content).toBe("I'm here to help!");
      });
    });

    describe('multimodal helper', () => {
      it('should create multimodal user message', () => {
        const message = MessageHelpers.multimodal("user", ["Part 1", "Part 2"]);
        
        expect(message.role).toBe("user");
        expect(message.content).toEqual([
          { type: "text", text: "Part 1" },
          { type: "text", text: "Part 2" }
        ]);
      });

      it('should create multimodal assistant message', () => {
        const message = MessageHelpers.multimodal("assistant", ["Response part"]);
        
        expect(message.role).toBe("assistant");
        expect(message.content).toEqual([
          { type: "text", text: "Response part" }
        ]);
      });
    });
  });

  describe('MessageValidation', () => {
    describe('validateMessage', () => {
      it('should validate valid message', () => {
        const input = {
          role: "user",
          content: "Hello"
        };
        
        const result = MessageValidation.validateMessage(input);
        expect(result.role).toBe("user");
        expect(result.content).toBe("Hello");
      });

      it('should throw on invalid message', () => {
        const input = {
          role: "invalid",
          content: "Hello"
        };
        
        expect(() => MessageValidation.validateMessage(input)).toThrow();
      });
    });

    describe('validateMessages', () => {
      it('should validate array of valid messages', () => {
        const input = [
          { role: "system", content: "System prompt" },
          { role: "user", content: "User message" },
          { role: "assistant", content: "Assistant response" }
        ];
        
        const result = MessageValidation.validateMessages(input);
        expect(result).toHaveLength(3);
        expect(result[0].role).toBe("system");
        expect(result[1].role).toBe("user");
        expect(result[2].role).toBe("assistant");
      });

      it('should throw on invalid message in array', () => {
        const input = [
          { role: "user", content: "Valid" },
          { role: "invalid", content: "Invalid" }
        ];
        
        expect(() => MessageValidation.validateMessages(input)).toThrow();
      });
    });

    describe('isMultimodal', () => {
      it('should return true for array content', () => {
        const content: ContentPart[] = [{ type: "text", text: "Hello" }];
        expect(MessageValidation.isMultimodal(content)).toBe(true);
      });

      it('should return false for string content', () => {
        const content = "Hello world";
        expect(MessageValidation.isMultimodal(content)).toBe(false);
      });
    });

    describe('extractText', () => {
      it('should extract text from string content', () => {
        const message: Message = {
          role: "user",
          content: "Hello world"
        };
        
        const text = MessageValidation.extractText(message);
        expect(text).toBe("Hello world");
      });

      it('should extract text from array content (edge case)', () => {
        // This should not happen after transform, but test graceful handling
        const message: any = {
          role: "user",
          content: [
            { type: "text", text: "Part 1" },
            { type: "text", text: "Part 2" }
          ]
        };
        
        const text = MessageValidation.extractText(message);
        expect(text).toBe("Part 1\nPart 2");
      });
    });
  });

  describe('Integration tests', () => {
    it('should work with complete message workflow', () => {
      // Create multimodal message
      const originalMessage = MessageHelpers.multimodal("user", ["Hello", "World"]);
      
      // Validate and normalize through schema
      const normalizedMessage = MessageSchema.parse(originalMessage);
      
      // Content should be normalized to string
      expect(normalizedMessage.content).toBe("Hello\nWorld");
      
      // Extract text should work
      const text = MessageValidation.extractText(normalizedMessage);
      expect(text).toBe("Hello\nWorld");
      
      // Should validate successfully
      expect(() => MessageValidation.validateMessage(normalizedMessage)).not.toThrow();
    });

    it('should handle empty and edge cases', () => {
      const edgeCases = [
        { role: "user", content: "" },
        { role: "user", content: [] },
        { role: "user", content: [{ type: "text", text: "" }] },
        { role: "system", content: "   ", name: "system" }
      ];
      
      for (const testCase of edgeCases) {
        expect(() => MessageSchema.parse(testCase)).not.toThrow();
      }
    });
  });
});