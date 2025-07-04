/**
 * Tool Call ID Generator Unit Tests
 * Phase 4A: Response Formatting Implementation
 *
 * Tests tool call ID generation in OpenAI call_xxx format
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  ToolCallIdGenerator,
  IToolCallIdGenerator,
  ToolCallIdGenerationError,
  IdGenerationUtils,
} from "../../../src/tools/id-generator";
import { ID_FORMATS } from "../../../src/tools/constants";

describe("ToolCallIdGenerator", () => {
  let generator: IToolCallIdGenerator;

  beforeEach(() => {
    generator = new ToolCallIdGenerator();
  });

  describe("generateId", () => {
    it("should generate valid OpenAI format ID", () => {
      const id = generator.generateId();

      expect(id).toMatch(/^call_[A-Za-z0-9]{25}$/);
      expect(id.length).toBe(ID_FORMATS.CALL_ID_LENGTH);
      expect(id.startsWith(ID_FORMATS.CALL_PREFIX)).toBe(true);
    });

    it("should generate unique IDs", () => {
      const ids = new Set();
      const count = 100;

      for (let i = 0; i < count; i++) {
        const id = generator.generateId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }

      expect(ids.size).toBe(count);
    });

    it("should generate IDs with only valid characters", () => {
      const id = generator.generateId();
      const uniquePart = id.slice(ID_FORMATS.CALL_PREFIX.length);

      for (const char of uniquePart) {
        expect(ID_FORMATS.ID_CHARACTERS.includes(char)).toBe(true);
      }
    });

    it("should validate generated ID format", () => {
      const id = generator.generateId();
      expect(generator.isValidId(id)).toBe(true);
    });

    it("should handle ID generation errors gracefully", () => {
      // Mock crypto to fail
      const originalCrypto = (global as any).crypto;
      delete (global as any).crypto;

      // Also mock Math.random to return invalid values
      const originalRandom = Math.random;
      Math.random = () => NaN;

      try {
        // Should still generate a valid ID with fallback
        const id = generator.generateId();
        expect(typeof id).toBe("string");
        expect(id.startsWith(ID_FORMATS.CALL_PREFIX)).toBe(true);
      } finally {
        // Restore
        (global as any).crypto = originalCrypto;
        Math.random = originalRandom;
      }
    });
  });

  describe("generateIds", () => {
    it("should generate multiple unique IDs", () => {
      const count = 10;
      const ids = generator.generateIds(count);

      expect(ids).toHaveLength(count);
      expect(new Set(ids).size).toBe(count); // All unique

      for (const id of ids) {
        expect(generator.isValidId(id)).toBe(true);
      }
    });

    it("should return empty array for count <= 0", () => {
      expect(generator.generateIds(0)).toEqual([]);
      expect(generator.generateIds(-1)).toEqual([]);
    });

    it("should handle large batch generation", () => {
      const count = 1000;
      const ids = generator.generateIds(count);

      expect(ids).toHaveLength(count);
      expect(new Set(ids).size).toBe(count);
    });
  });

  describe("isValidId", () => {
    it("should validate correct OpenAI format IDs", () => {
      const validId = "call_" + "A".repeat(25);
      expect(generator.isValidId(validId)).toBe(true);
    });

    it("should reject IDs with wrong prefix", () => {
      const invalidId = "wrong_" + "A".repeat(25);
      expect(generator.isValidId(invalidId)).toBe(false);
    });

    it("should reject IDs with wrong length", () => {
      const shortId = "call_ABC";
      const longId = "call_" + "A".repeat(50);

      expect(generator.isValidId(shortId)).toBe(false);
      expect(generator.isValidId(longId)).toBe(false);
    });

    it("should reject IDs with invalid characters", () => {
      const invalidChars = "call_" + "A".repeat(24) + "!";
      expect(generator.isValidId(invalidChars)).toBe(false);
    });

    it("should reject null/undefined/empty IDs", () => {
      expect(generator.isValidId("")).toBe(false);
      expect(generator.isValidId(null as any)).toBe(false);
      expect(generator.isValidId(undefined as any)).toBe(false);
    });
  });

  describe("validateIdFormat", () => {
    it("should validate proper ID format", () => {
      const id = generator.generateId();
      expect(generator.validateIdFormat(id)).toBe(true);
    });

    it("should reject malformed IDs", () => {
      expect(generator.validateIdFormat("invalid")).toBe(false);
      expect(generator.validateIdFormat("call_")).toBe(false);
      expect(generator.validateIdFormat("call_short")).toBe(false);
    });

    it("should handle validation edge cases", () => {
      expect(generator.validateIdFormat("")).toBe(false);
      expect(generator.validateIdFormat("call_" + "1".repeat(25))).toBe(true);
      expect(generator.validateIdFormat("call_" + "z".repeat(25))).toBe(true);
    });
  });

  describe("memory management", () => {
    it("should track used IDs internally", () => {
      const generator = new ToolCallIdGenerator();
      const id1 = generator.generateId();
      const id2 = generator.generateId();

      expect(generator.getUsedIdsCount()).toBe(2);
      expect(id1).not.toBe(id2);
    });

    it("should clear used IDs when requested", () => {
      const generator = new ToolCallIdGenerator();
      generator.generateId();
      generator.generateId();

      expect(generator.getUsedIdsCount()).toBe(2);

      generator.clearUsedIds();
      expect(generator.getUsedIdsCount()).toBe(0);
    });

    it("should handle collision avoidance", () => {
      const generator = new ToolCallIdGenerator();

      // Generate many IDs to test collision handling
      const ids = [];
      for (let i = 0; i < 100; i++) {
        ids.push(generator.generateId());
      }

      // All should be unique
      expect(new Set(ids).size).toBe(100);
    });
  });
});

describe("IdGenerationUtils", () => {
  describe("extractUniqueId", () => {
    it("should extract unique part from valid ID", () => {
      const uniquePart = "ABCDEFGHIJKLMNOPQRSTUVWXY";
      const id = `call_${uniquePart}`;

      expect(IdGenerationUtils.extractUniqueId(id)).toBe(uniquePart);
    });

    it("should return null for invalid IDs", () => {
      expect(IdGenerationUtils.extractUniqueId("invalid")).toBeNull();
      expect(IdGenerationUtils.extractUniqueId("wrong_prefix")).toBeNull();
    });
  });

  describe("isOpenAIFormat", () => {
    it("should identify valid OpenAI format IDs", () => {
      const validId = "call_" + "A".repeat(25);
      expect(IdGenerationUtils.isOpenAIFormat(validId)).toBe(true);
    });

    it("should reject invalid format IDs", () => {
      expect(IdGenerationUtils.isOpenAIFormat("invalid")).toBe(false);
      expect(IdGenerationUtils.isOpenAIFormat("call_short")).toBe(false);
    });
  });

  describe("areIdsUnique", () => {
    it("should detect unique ID arrays", () => {
      const uniqueIds = ["call_A".padEnd(29, "1"), "call_B".padEnd(29, "2")];
      expect(IdGenerationUtils.areIdsUnique(uniqueIds)).toBe(true);
    });

    it("should detect duplicate IDs", () => {
      const duplicateIds = ["call_A".padEnd(29, "1"), "call_A".padEnd(29, "1")];
      expect(IdGenerationUtils.areIdsUnique(duplicateIds)).toBe(false);
    });

    it("should handle empty arrays", () => {
      expect(IdGenerationUtils.areIdsUnique([])).toBe(true);
    });
  });

  describe("generateBatch", () => {
    it("should generate batch with default generator", () => {
      const ids = IdGenerationUtils.generateBatch(5);

      expect(ids).toHaveLength(5);
      expect(IdGenerationUtils.areIdsUnique(ids)).toBe(true);

      for (const id of ids) {
        expect(IdGenerationUtils.isOpenAIFormat(id)).toBe(true);
      }
    });

    it("should use provided generator", () => {
      const customGenerator = new ToolCallIdGenerator();
      const ids = IdGenerationUtils.generateBatch(3, customGenerator);

      expect(ids).toHaveLength(3);
      expect(customGenerator.getUsedIdsCount()).toBe(3);
    });
  });
});

describe("ToolCallIdGenerationError", () => {
  it("should create error with correct properties", () => {
    const error = new ToolCallIdGenerationError(
      "Test error",
      "TEST_CODE",
      "test_id"
    );

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.attemptedId).toBe("test_id");
    expect(error.name).toBe("ToolCallIdGenerationError");
  });

  it("should work without optional parameters", () => {
    const error = new ToolCallIdGenerationError("Test error", "TEST_CODE");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.attemptedId).toBeUndefined();
  });
});

describe("Performance Tests", () => {
  it("should generate IDs within performance limits", () => {
    const generator = new ToolCallIdGenerator();
    const count = 1000;

    const startTime = Date.now();
    const ids = generator.generateIds(count);
    const duration = Date.now() - startTime;

    expect(ids).toHaveLength(count);
    expect(duration).toBeLessThan(100); // Should be very fast
    expect(new Set(ids).size).toBe(count); // All unique
  });

  it("should validate IDs quickly", () => {
    const generator = new ToolCallIdGenerator();
    const ids = generator.generateIds(100);

    const startTime = Date.now();
    for (const id of ids) {
      expect(generator.isValidId(id)).toBe(true);
    }
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(15); // Validation should be very fast
  });
});
