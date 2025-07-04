/**
 * Tool call ID generation service
 * Single Responsibility: ID generation only
 * 
 * Generates unique tool call IDs in OpenAI call_xxx format
 */

import { webcrypto } from 'crypto';
import { ID_FORMATS, RESPONSE_FORMATTING_ERRORS, RESPONSE_FORMATTING_MESSAGES } from './constants';

/**
 * Tool call ID generation error
 */
export class ToolCallIdGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly attemptedId?: string
  ) {
    super(message);
    this.name = 'ToolCallIdGenerationError';
  }
}

/**
 * Tool call ID generator interface
 */
export interface IToolCallIdGenerator {
  generateId(): string;
  generateIds(count: number): string[];
  isValidId(id: string): boolean;
  validateIdFormat(id: string): boolean;
}

/**
 * Tool call ID generator implementation
 */
export class ToolCallIdGenerator implements IToolCallIdGenerator {
  private usedIds: Set<string> = new Set();

  /**
   * Generate a unique tool call ID in call_xxx format
   */
  generateId(): string {
    try {
      const uniquePart = this.generateUniqueString();
      const id = `${ID_FORMATS.CALL_PREFIX}${uniquePart}`;
      
      // Ensure uniqueness
      if (this.usedIds.has(id)) {
        return this.generateId(); // Retry with new ID
      }
      
      this.usedIds.add(id);
      
      if (!this.validateIdFormat(id)) {
        throw new ToolCallIdGenerationError(
          RESPONSE_FORMATTING_MESSAGES.ID_GENERATION_FAILED,
          RESPONSE_FORMATTING_ERRORS.ID_GENERATION_FAILED,
          id
        );
      }
      
      return id;
    } catch (error) {
      throw new ToolCallIdGenerationError(
        error instanceof Error ? error.message : RESPONSE_FORMATTING_MESSAGES.ID_GENERATION_FAILED,
        RESPONSE_FORMATTING_ERRORS.ID_GENERATION_FAILED
      );
    }
  }

  /**
   * Generate multiple unique tool call IDs
   */
  generateIds(count: number): string[] {
    if (count <= 0) {
      return [];
    }

    const ids: string[] = [];
    
    for (let i = 0; i < count; i++) {
      ids.push(this.generateId());
    }
    
    return ids;
  }

  /**
   * Check if ID is valid and follows OpenAI format
   */
  isValidId(id: string): boolean {
    return this.validateIdFormat(id);
  }

  /**
   * Validate ID format matches OpenAI specification
   */
  validateIdFormat(id: string): boolean {
    try {
      // Check basic format
      if (!id || typeof id !== 'string') {
        return false;
      }

      // Check prefix
      if (!id.startsWith(ID_FORMATS.CALL_PREFIX)) {
        return false;
      }

      // Check total length
      if (id.length !== ID_FORMATS.CALL_ID_LENGTH) {
        return false;
      }

      // Check unique part contains only valid characters
      const uniquePart = id.slice(ID_FORMATS.CALL_PREFIX.length);
      return this.isValidUniqueString(uniquePart);

    } catch (error) {
      return false;
    }
  }

  /**
   * Generate unique string part of ID
   */
  private generateUniqueString(): string {
    const length = ID_FORMATS.CALL_ID_LENGTH - ID_FORMATS.CALL_PREFIX.length;
    const characters = ID_FORMATS.ID_CHARACTERS;
    let result = '';

    // Use webcrypto.getRandomValues if available, otherwise Math.random
    if (typeof webcrypto !== 'undefined' && webcrypto.getRandomValues) {
      const array = new Uint8Array(length);
      webcrypto.getRandomValues(array);
      
      for (let i = 0; i < length; i++) {
        result += characters[array[i] % characters.length];
      }
    } else {
      // Fallback to Math.random for environments without crypto
      for (let i = 0; i < length; i++) {
        result += characters[Math.floor(Math.random() * characters.length)];
      }
    }

    return result;
  }

  /**
   * Validate unique string contains only allowed characters
   */
  private isValidUniqueString(uniqueString: string): boolean {
    if (!uniqueString || uniqueString.length !== ID_FORMATS.CALL_ID_LENGTH - ID_FORMATS.CALL_PREFIX.length) {
      return false;
    }

    for (const char of uniqueString) {
      if (!ID_FORMATS.ID_CHARACTERS.includes(char)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clear used IDs cache (for testing)
   */
  clearUsedIds(): void {
    this.usedIds.clear();
  }

  /**
   * Get count of used IDs (for testing)
   */
  getUsedIdsCount(): number {
    return this.usedIds.size;
  }
}

/**
 * ID generation utilities
 */
export const IdGenerationUtils = {
  /**
   * Extract unique part from tool call ID
   */
  extractUniqueId: (id: string): string | null => {
    if (!id.startsWith(ID_FORMATS.CALL_PREFIX)) {
      return null;
    }
    return id.slice(ID_FORMATS.CALL_PREFIX.length);
  },

  /**
   * Check if ID is OpenAI format
   */
  isOpenAIFormat: (id: string): boolean => {
    return id.startsWith(ID_FORMATS.CALL_PREFIX) && id.length === ID_FORMATS.CALL_ID_LENGTH;
  },

  /**
   * Validate multiple IDs for uniqueness
   */
  areIdsUnique: (ids: string[]): boolean => {
    const uniqueIds = new Set(ids);
    return uniqueIds.size === ids.length;
  },

  /**
   * Generate batch of IDs with guaranteed uniqueness
   */
  generateBatch: (count: number, generator?: IToolCallIdGenerator): string[] => {
    const gen = generator || new ToolCallIdGenerator();
    return gen.generateIds(count);
  }
};

/**
 * Default tool call ID generator instance
 */
export const toolCallIdGenerator = new ToolCallIdGenerator();