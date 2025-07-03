/**
 * Integration tests for Message Processing Pipeline
 * Tests the complete flow from OpenAI messages to Claude responses
 * Based on Python message_adapter.py full workflow validation
 */

import { 
  MessageAdapter,
  ContentFilter,
  TokenEstimator
} from '../../../src/message';
import { MessageHelpers } from '../../../src/models/message';

// Mock logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('Message Processing Pipeline Integration', () => {
  describe('Complete OpenAI to Claude workflow', () => {
    it('should process a typical chat completion request', () => {
      // Input: OpenAI format messages
      const openAIMessages = [
        MessageHelpers.system("You are a helpful programming assistant."),
        MessageHelpers.user("Can you help me write a Python function to calculate fibonacci numbers?"),
        MessageHelpers.assistant("I'll help you create a fibonacci function. Here's an efficient implementation:\n\n```python\ndef fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)\n```"),
        MessageHelpers.user("Can you optimize this for better performance?")
      ];

      // Step 1: Convert to Claude format
      const conversionResult = MessageAdapter.messagesToPrompt(openAIMessages);
      
      expect(conversionResult.systemPrompt).toBe("You are a helpful programming assistant.");
      expect(conversionResult.prompt).toContain("Human: Can you help me write a Python function");
      expect(conversionResult.prompt).toContain("Assistant: I'll help you create a fibonacci function");
      expect(conversionResult.prompt).toContain("Human: Can you optimize this for better performance?");

      // Step 2: Estimate input tokens
      const inputTokens = TokenEstimator.estimateTokens(conversionResult.prompt);
      expect(inputTokens).toBeGreaterThan(0);

      // Step 3: Simulate Claude response with tool usage
      const simulatedClaudeResponse = `
        <thinking>
        The user wants me to optimize the fibonacci function. The current implementation
        uses naive recursion which is very inefficient. I should provide a memoized version
        or an iterative approach.
        </thinking>
        
        <attempt_completion>
        Certainly! The recursive approach has exponential time complexity. Here's an optimized version using memoization:
        
        \`\`\`python
        def fibonacci_optimized(n, memo={}):
            if n in memo:
                return memo[n]
            if n <= 1:
                return n
            memo[n] = fibonacci_optimized(n-1, memo) + fibonacci_optimized(n-2, memo)
            return memo[n]
        \`\`\`
        
        This reduces the time complexity from O(2^n) to O(n).
        </attempt_completion>
      `;

      // Step 4: Filter Claude response
      const filteredResponse = ContentFilter.filterContent(simulatedClaudeResponse);
      
      expect(filteredResponse).not.toContain("<thinking>");
      expect(filteredResponse).not.toContain("<attempt_completion>");
      expect(filteredResponse).toContain("Certainly! The recursive approach");
      expect(filteredResponse).toContain("fibonacci_optimized");
      expect(filteredResponse).toContain("time complexity from O(2^n) to O(n)");

      // Step 5: Estimate output tokens
      const outputTokens = TokenEstimator.estimateTokens(filteredResponse);
      expect(outputTokens).toBeGreaterThan(0);

      // Step 6: Calculate total usage
      const tokenUsage = TokenEstimator.calculateUsage(conversionResult.prompt, filteredResponse);
      expect(tokenUsage.prompt_tokens).toBe(inputTokens);
      expect(tokenUsage.completion_tokens).toBe(outputTokens);
      expect(tokenUsage.total_tokens).toBe(inputTokens + outputTokens);

      // Step 7: Format for OpenAI response
      const openAIResponse = MessageAdapter.formatClaudeResponse(
        filteredResponse,
        "claude-3-5-sonnet-20241022"
      );

      expect(openAIResponse.role).toBe("assistant");
      expect(openAIResponse.content).toBe(filteredResponse);
      expect(openAIResponse.finish_reason).toBe("stop");
      expect(openAIResponse.model).toBe("claude-3-5-sonnet-20241022");
    });

    it('should handle complex conversation with multiple tool calls', () => {
      const messages = [
        MessageHelpers.system("You are a code review assistant."),
        MessageHelpers.user("Please review this code and suggest improvements."),
        MessageHelpers.assistant("I'll review your code. Could you please share the code you'd like me to review?"),
        MessageHelpers.user("Here's a JavaScript function:\n\nfunction calculateArea(shape, ...params) {\n  if (shape === 'circle') {\n    return Math.PI * params[0] * params[0];\n  } else if (shape === 'rectangle') {\n    return params[0] * params[1];\n  }\n}")
      ];

      const conversionResult = MessageAdapter.messagesToPrompt(messages);

      // Simulate complex Claude response with multiple tools
      const complexResponse = `
        <thinking>
        Let me analyze this JavaScript function. I can see several areas for improvement:
        1. No input validation
        2. Hard-coded shape types
        3. No error handling
        4. Could use better parameter naming
        </thinking>

        I'll review your JavaScript function and provide some suggestions:

        <read_file>
        function calculateArea(shape, ...params) {
          if (shape === 'circle') {
            return Math.PI * params[0] * params[0];
          } else if (shape === 'rectangle') {
            return params[0] * params[1];
          }
        }
        </read_file>

        <attempt_completion>
        <result>
        Here's my code review with suggestions:

        **Issues identified:**
        1. No input validation
        2. No default case for unknown shapes
        3. Magic numbers and unclear parameter names
        4. No JSDoc documentation

        **Improved version:**
        \`\`\`javascript
        /**
         * Calculates the area of geometric shapes
         * @param {string} shape - The shape type ('circle' or 'rectangle')
         * @param {...number} params - Shape-specific parameters
         * @returns {number} The calculated area
         * @throws {Error} When invalid parameters are provided
         */
        function calculateArea(shape, ...params) {
          if (!shape || typeof shape !== 'string') {
            throw new Error('Shape must be a non-empty string');
          }

          const shapeType = shape.toLowerCase();

          switch (shapeType) {
            case 'circle':
              if (params.length !== 1 || params[0] <= 0) {
                throw new Error('Circle requires one positive radius parameter');
              }
              const radius = params[0];
              return Math.PI * radius * radius;

            case 'rectangle':
              if (params.length !== 2 || params.some(p => p <= 0)) {
                throw new Error('Rectangle requires two positive parameters (width, height)');
              }
              const [width, height] = params;
              return width * height;

            default:
              throw new Error(\`Unsupported shape: \${shape}\`);
          }
        }
        \`\`\`

        **Improvements made:**
        - Added comprehensive input validation
        - Used destructuring for better readability
        - Added JSDoc documentation
        - Implemented proper error handling
        - Used switch statement for better extensibility
        </result>
        </attempt_completion>

        <bash>
        # Test the improved function
        console.log(calculateArea('circle', 5)); // Should output: 78.54
        console.log(calculateArea('rectangle', 4, 6)); // Should output: 24
        </bash>
      `;

      const filteredResponse = ContentFilter.filterContent(complexResponse);

      // Verify filtering worked correctly
      expect(filteredResponse).not.toContain("<thinking>");
      expect(filteredResponse).not.toContain("<read_file>");
      expect(filteredResponse).not.toContain("<bash>");
      expect(filteredResponse).not.toContain("<attempt_completion>");
      expect(filteredResponse).not.toContain("<result>");

      // Verify the actual content is preserved
      expect(filteredResponse).toContain("Here's my code review with suggestions:");
      expect(filteredResponse).toContain("**Issues identified:**");
      expect(filteredResponse).toContain("**Improved version:**");
      expect(filteredResponse).toContain("function calculateArea(shape, ...params)");
      expect(filteredResponse).toContain("**Improvements made:**");

      // Verify the final response formatting
      const finalResponse = MessageAdapter.formatClaudeResponse(
        filteredResponse,
        "claude-3-5-sonnet-20241022"
      );

      expect(finalResponse.content).toBe(filteredResponse);
      expect(finalResponse.role).toBe("assistant");
    });

    it('should handle conversation with image references', () => {
      const messages = [
        MessageHelpers.system("You are a helpful visual assistant."),
        MessageHelpers.user("Can you analyze this screenshot for me?")
      ];

      const conversionResult = MessageAdapter.messagesToPrompt(messages);

      // Simulate Claude response with image handling
      const responseWithImages = `
        I can see the image you've shared: [Image: screenshot.png]
        
        Based on the screenshot, I can observe several UI elements. Here's the base64 data I'm analyzing: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA...
        
        <attempt_completion>
        Looking at your screenshot, I can identify the following elements:
        
        1. Navigation menu at the top
        2. Main content area with form fields
        3. Submit button at the bottom
        
        The layout appears to be a standard web form. Another image reference: [Image: detail.jpg] shows additional context.
        </attempt_completion>
      `;

      const filteredResponse = ContentFilter.filterContent(responseWithImages);

      // Verify image references are replaced
      expect(filteredResponse).not.toContain("[Image: screenshot.png]");
      expect(filteredResponse).not.toContain("[Image: detail.jpg]");
      expect(filteredResponse).not.toContain("data:image/png;base64");
      expect(filteredResponse).toContain("[Image: Content not supported by Claude Code]");

      // Count occurrences of the placeholder (only images within attempt_completion are preserved)
      const placeholderCount = (filteredResponse.match(/\[Image: Content not supported by Claude Code\]/g) || []).length;
      expect(placeholderCount).toBe(1); // Only 1 named image within attempt_completion (base64 and first image are outside)

      // Verify content structure is preserved
      expect(filteredResponse).toContain("Looking at your screenshot");
      expect(filteredResponse).toContain("Navigation menu at the top");
      expect(filteredResponse).toContain("Submit button at the bottom");
    });

    it('should handle empty or minimal responses gracefully', () => {
      const messages = [
        MessageHelpers.user("Hello")
      ];

      const conversionResult = MessageAdapter.messagesToPrompt(messages);

      // Test with effectively empty response
      const emptyResponse = `
        <thinking>
        The user just said hello. I should respond politely.
        </thinking>
        
        <attempt_completion>
        </attempt_completion>
      `;

      const filteredResponse = ContentFilter.filterContent(emptyResponse);

      // Should get fallback message for empty content
      expect(filteredResponse).toBe("I understand you're testing the system. How can I help you today?");

      const tokenUsage = TokenEstimator.calculateUsage(conversionResult.prompt, filteredResponse);
      expect(tokenUsage.completion_tokens).toBeGreaterThan(0);
    });

    it('should maintain conversation context through multiple turns', () => {
      const messages = [
        MessageHelpers.system("You are a math tutor."),
        MessageHelpers.user("What is 2 + 2?"),
        MessageHelpers.assistant("2 + 2 equals 4."),
        MessageHelpers.user("What about 3 + 3?"),
        MessageHelpers.assistant("3 + 3 equals 6."),
        MessageHelpers.user("Can you explain how addition works?")
      ];

      const conversionResult = MessageAdapter.messagesToPrompt(messages);

      // Verify conversation flow is maintained
      expect(conversionResult.prompt).toContain("Human: What is 2 + 2?");
      expect(conversionResult.prompt).toContain("Assistant: 2 + 2 equals 4.");
      expect(conversionResult.prompt).toContain("Human: What about 3 + 3?");
      expect(conversionResult.prompt).toContain("Assistant: 3 + 3 equals 6.");
      expect(conversionResult.prompt).toContain("Human: Can you explain how addition works?");

      // Verify system prompt is preserved
      expect(conversionResult.systemPrompt).toBe("You are a math tutor.");

      // Test message flow validation
      const isValidFlow = MessageAdapter.validateMessageFlow(messages);
      expect(isValidFlow).toBe(true);

      // Analyze conversation statistics
      const messageStats = MessageAdapter.analyzeMessages(messages);
      expect(messageStats).toEqual({
        system: 1,
        user: 3,
        assistant: 2,
        total: 6
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed input gracefully', () => {
      const emptyMessages: any[] = [];

      // Test empty message array
      const conversionResult = MessageAdapter.messagesToPrompt(emptyMessages);
      expect(conversionResult.prompt).toBe("");
      expect(conversionResult.systemPrompt).toBeNull();

      const isValidFlow = MessageAdapter.validateMessageFlow(emptyMessages);
      expect(isValidFlow).toBe(false);
    });

    it('should handle messages with complex content structures', () => {
      const complexMessages = [
        MessageHelpers.system("System with\nmultiple lines\nand special chars: @#$%"),
        MessageHelpers.multimodal("user", ["Text part", "Another part"]),
        MessageHelpers.assistant("Response with \"quotes\" and <tags>")
      ];

      const conversionResult = MessageAdapter.messagesToPrompt(complexMessages);

      expect(conversionResult.systemPrompt).toContain("multiple lines");
      expect(conversionResult.prompt).toContain("Text part\nAnother part");
      expect(conversionResult.prompt).toContain("Response with \"quotes\" and <tags>");
    });

    it('should handle very large messages efficiently', () => {
      const largeContent = "A".repeat(50000); // 50KB message
      const messages = [
        MessageHelpers.user(largeContent),
        MessageHelpers.assistant("Short response")
      ];

      const startTime = Date.now();
      const conversionResult = MessageAdapter.messagesToPrompt(messages);
      const conversionTime = Date.now() - startTime;

      // Should complete conversion in reasonable time (< 100ms)
      expect(conversionTime).toBeLessThan(100);

      const startTokenTime = Date.now();
      const tokens = TokenEstimator.estimateTokens(conversionResult.prompt);
      const tokenTime = Date.now() - startTokenTime;

      // Token estimation should be fast
      expect(tokenTime).toBeLessThan(50);
      expect(tokens).toBeGreaterThan(10000); // Large content should have many tokens
    });

    it('should handle token limits properly', () => {
      const mediumMessage = "A".repeat(4000); // 1000 tokens
      const tokens = TokenEstimator.estimateTokens(mediumMessage);

      expect(TokenEstimator.validateTokenLimit(tokens, 2000)).toBe(true);
      expect(TokenEstimator.validateTokenLimit(tokens, 500)).toBe(false);

      const cost = TokenEstimator.estimateCost({
        prompt_tokens: tokens,
        completion_tokens: 0,
        total_tokens: tokens
      });

      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('Performance and scalability', () => {
    it('should handle batch processing efficiently', () => {
      const batchMessages = Array.from({ length: 100 }, (_, i) => ({
        content: `Message ${i}: This is a test message with some content to simulate real usage.`
      }));

      const startTime = Date.now();
      const totalTokens = TokenEstimator.estimateMessagesTokens(batchMessages);
      const processingTime = Date.now() - startTime;

      expect(totalTokens).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(50); // Should process 100 messages quickly
    });

    it('should maintain consistency across multiple processing cycles', () => {
      const testMessage = "Consistent test message for repeatability";
      
      // Process the same message multiple times
      const results = Array.from({ length: 10 }, () => {
        const tokens = TokenEstimator.estimateTokens(testMessage);
        const filtered = ContentFilter.filterContent(testMessage);
        return { tokens, filtered };
      });

      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.tokens).toBe(firstResult.tokens);
        expect(result.filtered).toBe(firstResult.filtered);
      });
    });

    it('should handle concurrent processing scenarios', async () => {
      const messages = [
        "First concurrent message",
        "Second concurrent message", 
        "Third concurrent message"
      ];

      // Process messages concurrently
      const concurrentResults = await Promise.all(
        messages.map(async (message) => {
          return new Promise(resolve => {
            setTimeout(() => {
              const tokens = TokenEstimator.estimateTokens(message);
              const filtered = ContentFilter.filterContent(message);
              resolve({ tokens, filtered, original: message });
            }, Math.random() * 10);
          });
        })
      );

      expect(concurrentResults).toHaveLength(3);
      concurrentResults.forEach((result: any) => {
        expect(result.tokens).toBeGreaterThan(0);
        expect(result.filtered).toBe(result.original);
      });
    });
  });

  describe('Real-world integration scenarios', () => {
    it('should handle a complete chatbot conversation flow', () => {
      // Simulate a complete chatbot session
      const conversation = [
        MessageHelpers.system("You are ChatBot, a helpful AI assistant."),
        MessageHelpers.user("Hi there! I'm working on a React component and need help."),
        MessageHelpers.assistant("Hello! I'd be happy to help you with your React component. What specific issue are you facing?"),
        MessageHelpers.user("I need to create a component that fetches data and displays it in a table."),
        MessageHelpers.assistant("Great! I'll help you create a data table component. Here's a basic structure:\n\n```jsx\nimport React, { useState, useEffect } from 'react';\n\nconst DataTable = ({ apiUrl }) => {\n  const [data, setData] = useState([]);\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    fetch(apiUrl)\n      .then(response => response.json())\n      .then(data => {\n        setData(data);\n        setLoading(false);\n      });\n  }, [apiUrl]);\n\n  if (loading) return <div>Loading...</div>;\n\n  return (\n    <table>\n      <thead>\n        <tr>\n          {Object.keys(data[0] || {}).map(key => (\n            <th key={key}>{key}</th>\n          ))}\n        </tr>\n      </thead>\n      <tbody>\n        {data.map((row, index) => (\n          <tr key={index}>\n            {Object.values(row).map((value, i) => (\n              <td key={i}>{value}</td>\n            ))}\n          </tr>\n        ))}\n      </tbody>\n    </table>\n  );\n};\n\nexport default DataTable;\n```"),
        MessageHelpers.user("This looks good! Can you add error handling?")
      ];

      // Process the entire conversation
      const conversionResult = MessageAdapter.messagesToPrompt(conversation);
      const inputTokens = TokenEstimator.estimateTokens(conversionResult.prompt);
      
      // Simulate final response with error handling
      const finalResponse = `
        <thinking>
        The user wants me to add error handling to the React component. I should add try-catch blocks and error state management.
        </thinking>

        <attempt_completion>
        Absolutely! Here's the enhanced version with comprehensive error handling:
        \`\`\`jsx
        import React, { useState, useEffect } from 'react';

        const DataTable = ({ apiUrl }) => {
          const [data, setData] = useState([]);
          const [loading, setLoading] = useState(true);
          const [error, setError] = useState(null);

          useEffect(() => {
            const fetchData = async () => {
              try {
                setLoading(true);
                setError(null);
                
                const response = await fetch(apiUrl);
                
                if (!response.ok) {
                  throw new Error(\`HTTP error! status: \${response.status}\`);
                }
                
                const jsonData = await response.json();
                setData(jsonData);
              } catch (err) {
                setError(err.message);
                console.error('Error fetching data:', err);
              } finally {
                setLoading(false);
              }
            };

            if (apiUrl) {
              fetchData();
            }
          }, [apiUrl]);

          if (loading) return <div className="loading">Loading...</div>;
          if (error) return <div className="error">Error: {error}</div>;
          if (!data.length) return <div className="no-data">No data available</div>;

          return (
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(data[0]).map(key => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value, i) => (
                      <td key={i}>{String(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        };

        export default DataTable;
        \`\`\`

        **Key improvements:**
        - Added error state management
        - Implemented async/await for better error handling
        - Added response status checking
        - Added loading state management
        - Added proper cleanup with finally block
        - Added safety checks for empty data
        - Added basic CSS classes for styling hooks
        </attempt_completion>
      `;

      const filteredResponse = ContentFilter.filterContent(finalResponse);
      const outputTokens = TokenEstimator.estimateTokens(filteredResponse);
      const tokenUsage = TokenEstimator.calculateUsage(conversionResult.prompt, filteredResponse);

      // Verify the complete pipeline worked
      expect(conversionResult.systemPrompt).toBe("You are ChatBot, a helpful AI assistant.");
      expect(filteredResponse).toContain("enhanced version with comprehensive error handling");
      expect(filteredResponse).toContain("async/await for better error handling");
      expect(filteredResponse).not.toContain("<thinking>");
      expect(filteredResponse).not.toContain("<attempt_completion>");

      expect(tokenUsage.prompt_tokens).toBe(inputTokens);
      expect(tokenUsage.completion_tokens).toBe(outputTokens);
      expect(tokenUsage.total_tokens).toBeGreaterThan(100);

      // Validate the conversation flow
      const isValid = MessageAdapter.validateMessageFlow(conversation);
      expect(isValid).toBe(true);
    });
  });
});