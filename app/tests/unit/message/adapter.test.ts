/**
 * Unit tests for Message Adapter
 * Tests src/message/adapter.ts components
 * Based on Python message_adapter.py:6-34 validation patterns
 */

import {
  MessageAdapter,
  MessageConversionResult,
} from "../../../src/message/adapter";
import { MessageHelpers } from "../../../src/models/message";

// Mock logger to avoid console output during tests
jest.mock("../../../src/utils/logger", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe("MessageAdapter", () => {
  describe("messagesToPrompt", () => {
    describe("Basic message conversion", () => {
      it("should convert single user message", () => {
        const messages = [MessageHelpers.user("Hello, how are you?")];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toBe("Human: Hello, how are you?");
        expect(result.systemPrompt).toBeNull();
      });

      it("should convert user and assistant messages", () => {
        const messages = [
          MessageHelpers.user("Hello, how are you?"),
          MessageHelpers.assistant("I'm doing well, thank you!"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toBe(
          "Human: Hello, how are you?\n\nAssistant: I'm doing well, thank you!\n\nHuman: Please continue."
        );
      });

      it("should extract system prompt", () => {
        const messages = [
          MessageHelpers.system("You are a helpful assistant."),
          MessageHelpers.user("Hello!"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toBe("Human: Hello!");
        expect(result.systemPrompt).toBe("You are a helpful assistant.");
      });

      it("should use last system message as system prompt", () => {
        const messages = [
          MessageHelpers.system("First system message"),
          MessageHelpers.system("Second system message"),
          MessageHelpers.user("Hello!"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.systemPrompt).toBe("Second system message");
      });
    });

    describe("Conversation flow handling", () => {
      it("should add continuation prompt when last message is not from user", () => {
        const messages = [
          MessageHelpers.user("What's the weather?"),
          MessageHelpers.assistant("It's sunny today."),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toContain("Human: Please continue.");
      });

      it("should not add continuation prompt when last message is from user", () => {
        const messages = [
          MessageHelpers.assistant("Hello!"),
          MessageHelpers.user("How are you?"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).not.toContain("Human: Please continue.");
        expect(result.prompt).toBe("Assistant: Hello!\n\nHuman: How are you?");
      });

      it("should handle system message at any position", () => {
        const messages = [
          MessageHelpers.user("Hello"),
          MessageHelpers.system("You are helpful"),
          MessageHelpers.assistant("Hi there!"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toBe(
          "Human: Hello\n\nAssistant: Hi there!\n\nHuman: Please continue."
        );
        expect(result.systemPrompt).toBe("You are helpful");
      });
    });

    describe("Complex conversation scenarios", () => {
      it("should handle multi-turn conversation", () => {
        const messages = [
          MessageHelpers.system("You are a math tutor."),
          MessageHelpers.user("What is 2 + 2?"),
          MessageHelpers.assistant("2 + 2 equals 4."),
          MessageHelpers.user("What about 3 + 3?"),
          MessageHelpers.assistant("3 + 3 equals 6."),
          MessageHelpers.user("Thanks!"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        const expectedPrompt = [
          "Human: What is 2 + 2?",
          "Assistant: 2 + 2 equals 4.",
          "Human: What about 3 + 3?",
          "Assistant: 3 + 3 equals 6.",
          "Human: Thanks!",
        ].join("\n\n");

        expect(result.prompt).toBe(expectedPrompt);
        expect(result.systemPrompt).toBe("You are a math tutor.");
      });

      it("should handle only system messages", () => {
        const messages = [
          MessageHelpers.system("System instruction 1"),
          MessageHelpers.system("System instruction 2"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toBe("");
        expect(result.systemPrompt).toBe("System instruction 2");
      });

      it("should handle empty message array", () => {
        const messages: any[] = [];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toBe("");
        expect(result.systemPrompt).toBeNull();
      });

      it("should handle messages with empty content", () => {
        const messages = [
          MessageHelpers.user(""),
          MessageHelpers.assistant("Hello!"),
          MessageHelpers.user("Hi"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toBe("Human: \n\nAssistant: Hello!\n\nHuman: Hi");
      });
    });

    describe("Edge cases and special content", () => {
      it("should handle messages with newlines", () => {
        const messages = [
          MessageHelpers.user("Line 1\nLine 2\nLine 3"),
          MessageHelpers.assistant("Response line 1\nResponse line 2"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toContain("Human: Line 1\nLine 2\nLine 3");
        expect(result.prompt).toContain(
          "Assistant: Response line 1\nResponse line 2"
        );
      });

      it("should handle messages with special characters", () => {
        const messages = [
          MessageHelpers.user('Message with "quotes" and <tags>'),
          MessageHelpers.assistant("Response with symbols: @#$%^&*()"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toContain(
          'Human: Message with "quotes" and <tags>'
        );
        expect(result.prompt).toContain(
          "Assistant: Response with symbols: @#$%^&*()"
        );
      });

      it("should handle very long messages", () => {
        const longContent = "A".repeat(10000);
        const messages = [
          MessageHelpers.user(longContent),
          MessageHelpers.assistant("Short response"),
        ];

        const result = MessageAdapter.messagesToPrompt(messages);

        expect(result.prompt).toContain(`Human: ${longContent}`);
        expect(result.prompt).toContain("Assistant: Short response");
      });
    });
  });

  describe("formatClaudeResponse", () => {
    it("should format basic response", () => {
      const response = MessageAdapter.formatClaudeResponse(
        "Hello there!",
        "claude-3-5-sonnet-20241022"
      );

      expect(response).toEqual({
        role: "assistant",
        content: "Hello there!",
        finish_reason: "stop",
        model: "claude-3-5-sonnet-20241022",
      });
    });

    it("should format response with custom finish reason", () => {
      const response = MessageAdapter.formatClaudeResponse(
        "Partial response...",
        "claude-3-5-sonnet-20241022",
        "length"
      );

      expect(response.finish_reason).toBe("length");
    });

    it("should handle empty content", () => {
      const response = MessageAdapter.formatClaudeResponse(
        "",
        "claude-3-5-sonnet-20241022"
      );

      expect(response.content).toBe("");
      expect(response.role).toBe("assistant");
    });
  });

  describe("validateMessageFlow", () => {
    it("should validate proper message flow ending with user", () => {
      const messages = [
        MessageHelpers.system("You are helpful"),
        MessageHelpers.assistant("Hello!"),
        MessageHelpers.user("Hi there!"),
      ];

      const isValid = MessageAdapter.validateMessageFlow(messages);

      expect(isValid).toBe(true);
    });

    it("should reject message flow ending with assistant", () => {
      const messages = [
        MessageHelpers.user("Hello!"),
        MessageHelpers.assistant("Hi there!"),
      ];

      const isValid = MessageAdapter.validateMessageFlow(messages);

      expect(isValid).toBe(false);
    });

    it("should reject empty message array", () => {
      const messages: any[] = [];

      const isValid = MessageAdapter.validateMessageFlow(messages);

      expect(isValid).toBe(false);
    });

    it("should reject only system messages", () => {
      const messages = [MessageHelpers.system("System instruction")];

      const isValid = MessageAdapter.validateMessageFlow(messages);

      expect(isValid).toBe(false);
    });

    it("should validate when last non-system message is user", () => {
      const messages = [
        MessageHelpers.user("Hello!"),
        MessageHelpers.assistant("Hi!"),
        MessageHelpers.user("How are you?"),
        MessageHelpers.system("Late system message"),
      ];

      const isValid = MessageAdapter.validateMessageFlow(messages);

      expect(isValid).toBe(true);
    });
  });

  describe("analyzeMessages", () => {
    it("should count messages by role", () => {
      const messages = [
        MessageHelpers.system("System"),
        MessageHelpers.user("User 1"),
        MessageHelpers.assistant("Assistant 1"),
        MessageHelpers.user("User 2"),
        MessageHelpers.assistant("Assistant 2"),
        MessageHelpers.user("User 3"),
      ];

      const analysis = MessageAdapter.analyzeMessages(messages);

      expect(analysis).toEqual({
        system: 1,
        user: 3,
        assistant: 2,
        tool: 0,
        total: 6,
      });
    });

    it("should handle empty message array", () => {
      const messages: any[] = [];

      const analysis = MessageAdapter.analyzeMessages(messages);

      expect(analysis).toEqual({
        system: 0,
        user: 0,
        assistant: 0,
        tool: 0,
        total: 0,
      });
    });

    it("should handle single role messages", () => {
      const messages = [
        MessageHelpers.user("Message 1"),
        MessageHelpers.user("Message 2"),
        MessageHelpers.user("Message 3"),
      ];

      const analysis = MessageAdapter.analyzeMessages(messages);

      expect(analysis).toEqual({
        system: 0,
        user: 3,
        assistant: 0,
        tool: 0,
        total: 3,
      });
    });
  });

  describe("Legacy methods compatibility", () => {
    it("should maintain backward compatibility with convertToClaudeFormat", () => {
      const messages = [
        MessageHelpers.user("Hello!"),
        MessageHelpers.assistant("Hi there!"),
      ];

      const legacyResult = MessageAdapter.convertToClaudeFormat(messages);
      const newResult = MessageAdapter.messagesToPrompt(messages);

      expect(legacyResult).toBe(newResult.prompt);
    });

    it("should maintain backward compatibility with extractSystemPrompt", () => {
      const messages = [
        MessageHelpers.system("You are helpful"),
        MessageHelpers.user("Hello!"),
      ];

      const legacyResult = MessageAdapter.extractSystemPrompt(messages);
      const newResult = MessageAdapter.messagesToPrompt(messages);

      expect(legacyResult).toBe(newResult.systemPrompt);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle realistic chat conversation", () => {
      const messages = [
        MessageHelpers.system(
          "You are a helpful AI assistant. Be concise and accurate."
        ),
        MessageHelpers.user("Can you help me understand what TypeScript is?"),
        MessageHelpers.assistant(
          "TypeScript is a programming language developed by Microsoft. It's a superset of JavaScript that adds static type checking."
        ),
        MessageHelpers.user("What are the main benefits?"),
        MessageHelpers.assistant(
          "The main benefits include: better error detection, improved IDE support, easier refactoring, and enhanced code documentation."
        ),
        MessageHelpers.user("Thanks! Can you give me a simple example?"),
      ];

      const result = MessageAdapter.messagesToPrompt(messages);

      expect(result.systemPrompt).toBe(
        "You are a helpful AI assistant. Be concise and accurate."
      );
      expect(result.prompt).toContain(
        "Human: Can you help me understand what TypeScript is?"
      );
      expect(result.prompt).toContain(
        "Assistant: TypeScript is a programming language"
      );
      expect(result.prompt).toContain("Human: What are the main benefits?");
      expect(result.prompt).toContain("Assistant: The main benefits include");
      expect(result.prompt).toContain(
        "Human: Thanks! Can you give me a simple example?"
      );

      // Should not add continuation prompt since last message is from user
      expect(result.prompt).not.toContain("Human: Please continue.");
    });

    it("should work with multimodal content (converted to string)", () => {
      const messages = [
        MessageHelpers.multimodal("user", ["Please analyze", "this image"]),
        MessageHelpers.assistant(
          "I can see the content, but image analysis is not available in this context."
        ),
      ];

      const result = MessageAdapter.messagesToPrompt(messages);

      // Content should be converted to string by message schema transform
      expect(result.prompt).toContain("Human: Please analyze\nthis image");
      expect(result.prompt).toContain("Assistant: I can see the content");
    });
  });
});
