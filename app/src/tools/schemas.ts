/**
 * OpenAI Tools API Schemas
 * Zod validation schemas for OpenAI Tools API protocol
 * Simple, clean validation without complex mock infrastructure
 */

import { z } from 'zod';

/**
 * OpenAI function schema
 */
export const OpenAIFunctionSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().optional(),
  parameters: z.record(z.any()).optional()
});

/**
 * OpenAI tool schema
 */
export const OpenAIToolSchema = z.object({
  type: z.literal('function'),
  function: OpenAIFunctionSchema
});

/**
 * Tool choice schema
 */
export const OpenAIToolChoiceSchema = z.union([
  z.literal('auto'),
  z.literal('none'), 
  z.literal('required'),
  z.object({
    type: z.literal('function'),
    function: z.object({
      name: z.string()
    })
  })
]);

/**
 * Tools array schema (optional for chat completion requests)
 */
export const ToolsArraySchema = z.array(OpenAIToolSchema).optional();

/**
 * OpenAI tool call schema
 */
export const OpenAIToolCallSchema = z.object({
  id: z.string(),
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    arguments: z.string() // JSON string
  })
});

/**
 * Tool message schema
 */
export const ToolMessageSchema = z.object({
  role: z.literal('tool'),
  content: z.string(),
  tool_call_id: z.string()
});