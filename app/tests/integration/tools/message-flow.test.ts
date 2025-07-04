/**
 * Tool Message Flow Integration Tests (Phase 9A)
 * Tests complete integration of tool message processing components
 * Validates end-to-end message processing workflow
 */

import { ToolMessageProcessor } from '../../../src/tools/message-processor';
import { ToolResultHandler } from '../../../src/tools/result-handler';
import { ToolCallCorrelationService } from '../../../src/tools/correlation-service';
import { MessageAdapter } from '../../../src/message/adapter';
import { ParameterValidator } from '../../../src/validation/validator';
import { Message } from '../../../src/models/message';
import { MESSAGE_ROLES } from '../../../src/tools/constants';

describe('Tool Message Flow Integration', () => {
  let messageProcessor: ToolMessageProcessor;
  let resultHandler: ToolResultHandler;
  let correlationService: ToolCallCorrelationService;

  beforeEach(() => {
    messageProcessor = new ToolMessageProcessor();
    resultHandler = new ToolResultHandler();
    correlationService = new ToolCallCorrelationService();
  });

  describe('Complete Tool Message Workflow', () => {
    it('should process complete tool message workflow successfully', async () => {
      const toolCallId = 'call_workflow123test456';
      const sessionId = 'session_workflow123';

      // Step 1: Establish tool call correlation
      const correlationResult = await correlationService.correlateToolCall(toolCallId, sessionId);
      expect(correlationResult.success).toBe(true);
      expect(correlationResult.correlation?.status).toBe('pending');

      // Step 2: Create and process tool message
      const toolMessage: Message = {
        role: 'tool',
        content: 'Function executed successfully. Result: {"status": "completed", "data": [1, 2, 3]}',
        tool_call_id: toolCallId,
        name: 'test_function'
      };

      // Step 3: Process tool message
      const processingResult = await messageProcessor.processToolMessage(toolMessage);
      expect(processingResult.success).toBe(true);
      expect(processingResult.processedMessage?.role).toBe('tool');

      // Step 4: Handle tool result
      const handlingResult = await resultHandler.handleToolResult(toolMessage);
      expect(handlingResult.success).toBe(true);
      expect(handlingResult.result?.toolCallId).toBe(toolCallId);

      // Step 5: Correlate tool result
      const resultCorrelationResult = await correlationService.correlateToolResult(toolMessage);
      expect(resultCorrelationResult.success).toBe(true);
      expect(resultCorrelationResult.correlation?.status).toBe('completed');

      // Step 6: Verify correlation is updated
      const finalCorrelation = correlationService.getCorrelation(toolCallId);
      expect(finalCorrelation?.status).toBe('completed');
      expect(finalCorrelation?.sessionId).toBe(sessionId);
    });

    it('should handle multiple tool messages in sequence', async () => {
      const toolCalls = [
        { id: 'call_seq1', content: 'First tool result' },
        { id: 'call_seq2', content: 'Second tool result' },
        { id: 'call_seq3', content: 'Third tool result' }
      ];
      const sessionId = 'session_sequence123';

      // Establish all correlations
      for (const toolCall of toolCalls) {
        const result = await correlationService.correlateToolCall(toolCall.id, sessionId);
        expect(result.success).toBe(true);
      }

      // Process all tool messages
      const toolMessages: Message[] = toolCalls.map(tc => ({
        role: 'tool',
        content: tc.content,
        tool_call_id: tc.id
      }));

      // Batch process messages
      const batchProcessingResult = await messageProcessor.processBatchToolMessages(toolMessages);
      expect(batchProcessingResult.success).toBe(true);
      expect(batchProcessingResult.totalProcessed).toBe(3);

      // Batch handle results
      const batchHandlingResult = await resultHandler.handleBatchToolResults(toolMessages);
      expect(batchHandlingResult.success).toBe(true);
      expect(batchHandlingResult.totalHandled).toBe(3);

      // Correlate all results
      for (const message of toolMessages) {
        const correlationResult = await correlationService.correlateToolResult(message);
        expect(correlationResult.success).toBe(true);
      }

      // Verify all correlations are completed
      for (const toolCall of toolCalls) {
        const correlation = correlationService.getCorrelation(toolCall.id);
        expect(correlation?.status).toBe('completed');
      }
    });

    it('should integrate with MessageAdapter for conversation flow', async () => {
      const toolCallId = 'call_adapter123test456';

      // Establish correlation
      await correlationService.correlateToolCall(toolCallId);

      // Create conversation with tool message
      const messages: Message[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant with access to tools.'
        },
        {
          role: 'user',
          content: 'Please execute the test function.'
        },
        {
          role: 'assistant',
          content: 'I will execute the test function for you.',
          tool_calls: [{
            id: toolCallId,
            type: 'function',
            function: { name: 'test_function', arguments: '{}' }
          }]
        },
        {
          role: 'tool',
          content: 'Function executed successfully with result: 42',
          tool_call_id: toolCallId,
          name: 'test_function'
        }
      ];

      // Process through MessageAdapter
      const conversionResult = MessageAdapter.messagesToPrompt(messages);
      expect(conversionResult.prompt).toContain('Tool execution result');
      expect(conversionResult.prompt).toContain(toolCallId);

      // Validate tool messages
      const validationResult = MessageAdapter.validateToolMessages(messages);
      expect(validationResult).toBe(true);

      // Analyze message composition
      const analysis = MessageAdapter.analyzeMessages(messages);
      expect(analysis.tool).toBe(1);
      expect(analysis.assistant).toBe(1);
      expect(analysis.user).toBe(1);
      expect(analysis.system).toBe(1);
      expect(analysis.total).toBe(4);
    });

    it('should integrate with ParameterValidator for request validation', async () => {
      const toolCallId = 'call_validator123test456';

      // Create tool message
      const toolMessage: Message = {
        role: 'tool',
        content: 'Validation test result',
        tool_call_id: toolCallId
      };

      // Test individual tool message validation
      const messageValidation = ParameterValidator.validateToolMessage(toolMessage, 0);
      expect(messageValidation.valid).toBe(true);
      expect(messageValidation.errors).toHaveLength(0);

      // Test tool call ID validation
      const idValidation = ParameterValidator.validateToolCallId(toolCallId);
      expect(idValidation).toBe(true);

      // Test messages array with tool message
      const messages: Message[] = [
        {
          role: 'user',
          content: 'Test message'
        },
        toolMessage
      ];

      const messagesValidation = ParameterValidator.validateMessages(messages);
      expect(messagesValidation.valid).toBe(true);

      // Test tool message correlation validation
      const correlationValidation = ParameterValidator.validateToolMessageCorrelation(messages);
      expect(correlationValidation.valid).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle complete workflow with invalid tool message', async () => {
      const invalidMessage = {
        role: 'user', // Wrong role
        content: 'Invalid tool message',
        tool_call_id: 'call_invalid123test456'
      } as Message;

      // All components should reject invalid message
      const processingResult = await messageProcessor.processToolMessage(invalidMessage);
      expect(processingResult.success).toBe(false);

      const handlingResult = await resultHandler.handleToolResult(invalidMessage);
      expect(handlingResult.success).toBe(false);

      const correlationResult = await correlationService.correlateToolResult(invalidMessage);
      expect(correlationResult.success).toBe(false);

      // Validation should also fail
      const validation = ParameterValidator.validateToolMessage(invalidMessage, 0);
      expect(validation.valid).toBe(false);
    });

    it('should handle orphaned tool results', async () => {
      const orphanMessage: Message = {
        role: 'tool',
        content: 'Orphaned tool result',
        tool_call_id: 'call_orphan123test456'
      };

      // Processing and handling should succeed
      const processingResult = await messageProcessor.processToolMessage(orphanMessage);
      expect(processingResult.success).toBe(true);

      const handlingResult = await resultHandler.handleToolResult(orphanMessage);
      expect(handlingResult.success).toBe(true);

      // But correlation should fail (no prior tool call)
      const correlationResult = await correlationService.correlateToolResult(orphanMessage);
      expect(correlationResult.success).toBe(false);
    });

    it('should handle duplicate tool call IDs', async () => {
      const toolCallId = 'call_duplicate123test456';

      // First correlation should succeed
      const firstCorrelation = await correlationService.correlateToolCall(toolCallId);
      expect(firstCorrelation.success).toBe(true);

      // Second correlation should fail
      const secondCorrelation = await correlationService.correlateToolCall(toolCallId);
      expect(secondCorrelation.success).toBe(false);

      // But processing and handling should still work for messages
      const toolMessage: Message = {
        role: 'tool',
        content: 'Duplicate test result',
        tool_call_id: toolCallId
      };

      const processingResult = await messageProcessor.processToolMessage(toolMessage);
      expect(processingResult.success).toBe(true);

      const handlingResult = await resultHandler.handleToolResult(toolMessage);
      expect(handlingResult.success).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should meet end-to-end performance requirements', async () => {
      const toolCallId = 'call_performance123test456';
      const sessionId = 'session_performance123';

      const startTime = performance.now();

      // Complete workflow
      await correlationService.correlateToolCall(toolCallId, sessionId);

      const toolMessage: Message = {
        role: 'tool',
        content: 'Performance test result',
        tool_call_id: toolCallId
      };

      await messageProcessor.processToolMessage(toolMessage);
      await resultHandler.handleToolResult(toolMessage);
      await correlationService.correlateToolResult(toolMessage);

      const endTime = performance.now();

      // Total workflow should complete well under reasonable time
      expect(endTime - startTime).toBeLessThan(20); // 20ms for complete workflow
    });

    it('should handle high-volume tool message processing', async () => {
      const messageCount = 50;
      const sessionId = 'session_volume123';

      // Create many tool calls and messages
      const toolCalls = Array.from({ length: messageCount }, (_, i) => ({
        id: `call_volume${i}test${i}`,
        content: `Volume test result ${i}`
      }));

      const startTime = performance.now();

      // Establish all correlations
      for (const toolCall of toolCalls) {
        await correlationService.correlateToolCall(toolCall.id, sessionId);
      }

      // Create messages
      const toolMessages: Message[] = toolCalls.map(tc => ({
        role: 'tool',
        content: tc.content,
        tool_call_id: tc.id
      }));

      // Batch process
      const batchProcessingResult = await messageProcessor.processBatchToolMessages(toolMessages);
      const batchHandlingResult = await resultHandler.handleBatchToolResults(toolMessages);

      // Individual correlations
      for (const message of toolMessages) {
        await correlationService.correlateToolResult(message);
      }

      const endTime = performance.now();

      expect(batchProcessingResult.success).toBe(true);
      expect(batchHandlingResult.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 1 second for 50 messages
    });
  });

  describe('Session Management Integration', () => {
    it('should handle session-based tool call correlation', async () => {
      const sessionId = 'session_management123';
      const toolCalls = [
        'call_session1test',
        'call_session2test',
        'call_session3test'
      ];

      // Establish correlations for session
      for (const toolCallId of toolCalls) {
        const result = await correlationService.correlateToolCall(toolCallId, sessionId);
        expect(result.success).toBe(true);
      }

      // Verify all correlations exist
      for (const toolCallId of toolCalls) {
        expect(correlationService.hasCorrelation(toolCallId)).toBe(true);
      }

      // Clear session
      const removedCount = correlationService.clearSession(sessionId);
      expect(removedCount).toBe(3);

      // Verify all correlations are removed
      for (const toolCallId of toolCalls) {
        expect(correlationService.hasCorrelation(toolCallId)).toBe(false);
      }
    });

    it('should handle mixed session tool calls', async () => {
      const session1 = 'session_mixed1';
      const session2 = 'session_mixed2';

      // Add calls to different sessions
      await correlationService.correlateToolCall('call_mixed1session1', session1);
      await correlationService.correlateToolCall('call_mixed2session1', session1);
      await correlationService.correlateToolCall('call_mixed1session2', session2);
      await correlationService.correlateToolCall('call_mixed2session2', session2);

      // Clear only session1
      const removedCount = correlationService.clearSession(session1);
      expect(removedCount).toBe(2);

      // Verify session1 calls are removed, session2 calls remain
      expect(correlationService.hasCorrelation('call_mixed1session1')).toBe(false);
      expect(correlationService.hasCorrelation('call_mixed2session1')).toBe(false);
      expect(correlationService.hasCorrelation('call_mixed1session2')).toBe(true);
      expect(correlationService.hasCorrelation('call_mixed2session2')).toBe(true);
    });
  });

  describe('Edge Cases Integration', () => {
    it('should handle complex tool message content', async () => {
      const toolCallId = 'call_complex123test456';
      
      // Establish correlation
      await correlationService.correlateToolCall(toolCallId);

      // Complex JSON content
      const complexContent = JSON.stringify({
        status: 'success',
        results: [
          { id: 1, data: { nested: { deep: 'value' } } },
          { id: 2, data: { array: [1, 2, 3, 4, 5] } }
        ],
        metadata: {
          timestamp: Date.now(),
          version: '2.0.0',
          unicode: '测试数据 🚀'
        }
      });

      const toolMessage: Message = {
        role: 'tool',
        content: complexContent,
        tool_call_id: toolCallId,
        name: 'complex_tool'
      };

      // Process through all components
      const processingResult = await messageProcessor.processToolMessage(toolMessage);
      expect(processingResult.success).toBe(true);

      const handlingResult = await resultHandler.handleToolResult(toolMessage);
      expect(handlingResult.success).toBe(true);
      expect(handlingResult.result?.content).toBe(complexContent);

      const correlationResult = await correlationService.correlateToolResult(toolMessage);
      expect(correlationResult.success).toBe(true);

      // Verify content preservation
      const extracted = resultHandler.extractToolResult(toolMessage);
      expect(extracted?.content).toBe(complexContent);
      expect(extracted?.metadata?.name).toBe('complex_tool');
    });

    it('should handle error recovery scenarios', async () => {
      const toolCallId = 'call_recovery123test456';

      // Step 1: Establish correlation
      const correlationResult = await correlationService.correlateToolCall(toolCallId);
      expect(correlationResult.success).toBe(true);

      // Step 2: Simulate processing error with invalid message
      const invalidMessage = {
        role: 'tool',
        tool_call_id: toolCallId
        // Missing content
      } as Message;

      const processingResult = await messageProcessor.processToolMessage(invalidMessage);
      expect(processingResult.success).toBe(false);

      // Step 3: Correlation should still exist in pending state
      const correlation = correlationService.getCorrelation(toolCallId);
      expect(correlation?.status).toBe('pending');

      // Step 4: Process valid message for recovery
      const validMessage: Message = {
        role: 'tool',
        content: 'Recovery successful',
        tool_call_id: toolCallId
      };

      const recoveryResult = await messageProcessor.processToolMessage(validMessage);
      expect(recoveryResult.success).toBe(true);

      const finalCorrelationResult = await correlationService.correlateToolResult(validMessage);
      expect(finalCorrelationResult.success).toBe(true);

      // Step 5: Verify recovery completed
      const finalCorrelation = correlationService.getCorrelation(toolCallId);
      expect(finalCorrelation?.status).toBe('completed');
    });
  });
});