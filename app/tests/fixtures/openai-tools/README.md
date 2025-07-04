# OpenAI Tools Test Fixtures

Comprehensive test fixture files for OpenAI tools testing, covering all functionality from phases 1A-12A.

## 📁 File Structure

```
tests/fixtures/openai-tools/
├── sample-tools.ts      # Complete OpenAI tool definitions
├── test-requests.ts     # OpenAI-compatible request payloads
├── test-responses.ts    # Expected OpenAI-format responses
├── error-scenarios.ts   # Invalid input cases and error scenarios
├── index.ts            # Central export and utilities
└── README.md           # This documentation
```

## 🛠️ Usage Examples

### Basic Tool Testing

```typescript
import { SIMPLE_TOOLS, BASIC_TOOL_CHOICE_REQUESTS } from './fixtures/openai-tools';

// Test basic tool validation
const weatherTool = SIMPLE_TOOLS[0]; // get_weather tool
const request = BASIC_TOOL_CHOICE_REQUESTS.AUTO_CHOICE;

// Use in tests...
```

### Error Scenario Testing

```typescript
import { INVALID_TOOL_SCHEMAS, ERROR_SCENARIOS_BY_TYPE } from './fixtures/openai-tools';

// Test validation errors
const invalidTool = INVALID_TOOL_SCHEMAS[0]; // Missing type field
const validationErrors = ERROR_SCENARIOS_BY_TYPE.VALIDATION_ERROR;

// Test each error scenario...
```

### Phase-Specific Testing

```typescript
import { FIXTURES_BY_PURPOSE } from './fixtures/openai-tools';

// Test schema validation (Phase 1A)
const schemaFixtures = FIXTURES_BY_PURPOSE.SCHEMA_VALIDATION;

// Test multi-tool support (Phase 7A)
const multiToolFixtures = FIXTURES_BY_PURPOSE.MULTI_TOOL_SUPPORT;
```

### Performance Testing

```typescript
import { PERFORMANCE_TOOLS, LARGE_TOOL_ARRAY } from './fixtures/openai-tools';

// Test large schema performance
const largeSchemaTool = PERFORMANCE_TOOLS[0];

// Test array size limits
const maxTools = LARGE_TOOL_ARRAY.slice(0, 128);
```

## 📋 Available Collections

### Tool Definitions (`sample-tools.ts`)

- **SIMPLE_TOOLS**: Basic function tools with simple parameters
- **COMPLEX_TOOLS**: Tools with nested object parameters and arrays
- **SCHEMA_TYPE_TOOLS**: Tools covering all JSON schema types
- **PERFORMANCE_TOOLS**: Tools for performance and limit testing
- **MULTI_TOOL_SCENARIOS**: Multi-step workflow tools
- **EDGE_CASE_TOOLS**: Boundary condition and edge case tools
- **OPENAI_FEATURE_TOOLS**: Tools showcasing OpenAI API features
- **LARGE_TOOL_ARRAY**: Array of 100+ tools for limit testing

### Request Payloads (`test-requests.ts`)

- **BASIC_TOOL_CHOICE_REQUESTS**: Auto, none, and specific function choices
- **MULTI_TOOL_REQUESTS**: Multiple tools and workflow scenarios
- **SCHEMA_VALIDATION_REQUESTS**: Parameter type validation scenarios
- **STREAMING_REQUESTS**: Streaming vs non-streaming requests
- **TOOL_RESULT_REQUESTS**: Tool result message scenarios
- **EDGE_CASE_REQUESTS**: Boundary conditions and edge cases
- **PERFORMANCE_REQUESTS**: Large schema and performance testing
- **MODEL_VARIATION_REQUESTS**: Different model configurations
- **PARAMETER_VARIATION_REQUESTS**: Temperature, tokens, etc.

### Expected Responses (`test-responses.ts`)

- **BASIC_TOOL_RESPONSES**: Single and multiple tool call responses
- **COMPLEX_TOOL_RESPONSES**: Nested parameter responses
- **SCHEMA_TYPE_RESPONSES**: All JSON schema type responses
- **MULTI_TOOL_WORKFLOW_RESPONSES**: Multi-step workflow responses
- **STREAMING_RESPONSES**: Streaming response chunks
- **EDGE_CASE_RESPONSES**: Boundary condition responses
- **ERROR_RESPONSES**: API error responses (rate limits, etc.)

### Error Scenarios (`error-scenarios.ts`)

- **INVALID_TOOL_SCHEMAS**: Missing type, invalid structure
- **INVALID_FUNCTION_DEFINITIONS**: Name validation, description limits
- **INVALID_PARAMETER_SCHEMAS**: Depth limits, type validation
- **INVALID_TOOL_ARRAYS**: Empty arrays, duplicates, size limits
- **INVALID_TOOL_CHOICES**: Invalid choices, missing functions
- **PERFORMANCE_LIMIT_SCENARIOS**: Timeout and concurrency limits
- **FORMAT_ERROR_SCENARIOS**: Type errors, circular references
- **COMPLEX_ERROR_SCENARIOS**: Multiple validation issues

## 🎯 Testing by Phase

### Phase 1A: Schema Validation
```typescript
import { FIXTURES_BY_PURPOSE } from './fixtures/openai-tools';

const { tools, requests, errorScenarios } = FIXTURES_BY_PURPOSE.SCHEMA_VALIDATION;
// Test OpenAI schema validation
```

### Phase 2A: Parameter Processing
```typescript
const { tools, requests, responses } = FIXTURES_BY_PURPOSE.PARAMETER_PROCESSING;
// Test parameter extraction and validation
```

### Phase 3A: Format Conversion
```typescript
const { tools, requests, responses } = FIXTURES_BY_PURPOSE.FORMAT_CONVERSION;
// Test OpenAI ↔ Claude format conversion
```

### Phase 4A: Response Formatting
```typescript
const { responses } = FIXTURES_BY_PURPOSE.RESPONSE_FORMATTING;
// Test tool call response formatting
```

### Phase 5A: Tool Choice Logic
```typescript
const { requests, responses } = FIXTURES_BY_PURPOSE.TOOL_CHOICE;
// Test auto, none, and specific function choices
```

### Phase 6A: ID Management
```typescript
const { requests, responses } = FIXTURES_BY_PURPOSE.ID_MANAGEMENT;
// Test tool call ID generation and tracking
```

### Phase 7A: Multi-Tool Support
```typescript
const { tools, requests, responses } = FIXTURES_BY_PURPOSE.MULTI_TOOL_SUPPORT;
// Test parallel and sequential tool calls
```

### Phase 8A: Error Handling
```typescript
const { errorScenarios } = FIXTURES_BY_PURPOSE.ERROR_HANDLING;
// Test comprehensive error handling
```

### Phase 9A: Message Processing
```typescript
const { requests, responses } = FIXTURES_BY_PURPOSE.MESSAGE_PROCESSING;
// Test tool result message processing
```

### Phase 10A: Schema Registry
```typescript
const { tools } = FIXTURES_BY_PURPOSE.SCHEMA_REGISTRY;
// Test schema registration and lookup
```

### Phase 11A: State Management
```typescript
const { requests, responses } = FIXTURES_BY_PURPOSE.STATE_MANAGEMENT;
// Test tool call state tracking
```

### Phase 12A: Validation Framework
```typescript
const { tools, errorScenarios } = FIXTURES_BY_PURPOSE.VALIDATION_FRAMEWORK;
// Test comprehensive validation framework
```

## 🔧 Utility Functions

### Quick Access
```typescript
import { COMMON_FIXTURES } from './fixtures/openai-tools';

const basicTool = COMMON_FIXTURES.WEATHER_TOOL;
const basicRequest = COMMON_FIXTURES.AUTO_REQUEST;
const basicResponse = COMMON_FIXTURES.BASIC_RESPONSE;
```

### Random Data Generation
```typescript
import { FIXTURE_UTILS } from './fixtures/openai-tools';

const randomTool = FIXTURE_UTILS.getRandomTool();
const basicTools = FIXTURE_UTILS.getToolsByComplexity('basic');
const validationErrors = FIXTURE_UTILS.getErrorsByType('validation_error');
```

### Test Helper Functions
```typescript
import { FIXTURE_UTILS } from './fixtures/openai-tools';

// Create test request
const request = FIXTURE_UTILS.createTestRequest([weatherTool], 'auto');

// Create expected response
const response = FIXTURE_UTILS.createExpectedResponse([toolCall]);
```

## 📊 Coverage Statistics

### Tool Types Covered
- ✅ Simple function tools
- ✅ Complex nested object parameters
- ✅ All JSON schema types (string, number, integer, boolean, object, array, null)
- ✅ Array parameters with various item types
- ✅ Enum and pattern validations
- ✅ Min/max constraints
- ✅ Required vs optional parameters
- ✅ Default values
- ✅ Nested objects up to depth limits
- ✅ Edge cases and boundary conditions

### Request Scenarios Covered
- ✅ Tool choice: auto, none, specific function
- ✅ Single and multiple tool requests
- ✅ Streaming and non-streaming
- ✅ Various model configurations
- ✅ Parameter variations (temperature, max_tokens)
- ✅ Tool result messages
- ✅ Edge cases and error conditions

### Error Scenarios Covered
- ✅ Schema validation errors (60+ scenarios)
- ✅ Parameter validation errors (20+ scenarios)
- ✅ Array validation errors (15+ scenarios)
- ✅ Tool choice validation errors (10+ scenarios)
- ✅ Performance limit errors (5+ scenarios)
- ✅ Format and structure errors (10+ scenarios)
- ✅ Complex multi-error scenarios

### OpenAI API Compatibility
- ✅ Exact OpenAI API request format
- ✅ Exact OpenAI API response format
- ✅ OpenAI streaming response format
- ✅ OpenAI error response format
- ✅ All OpenAI function calling features
- ✅ OpenAI tool call ID format
- ✅ OpenAI JSON schema compliance

## 🚀 Getting Started

1. **Import what you need**:
   ```typescript
   import { SIMPLE_TOOLS, BASIC_TOOL_RESPONSES } from './fixtures/openai-tools';
   ```

2. **Use in your tests**:
   ```typescript
   describe('Tool Validation', () => {
     it('should validate simple tools', () => {
       const tool = SIMPLE_TOOLS[0];
       const result = validator.validateTool(tool);
       expect(result.valid).toBe(true);
     });
   });
   ```

3. **Test error scenarios**:
   ```typescript
   describe('Error Handling', () => {
     INVALID_TOOL_SCHEMAS.forEach(scenario => {
       it(`should handle ${scenario.name}`, () => {
         const result = validator.validateTool(scenario.input);
         expect(result.valid).toBe(false);
         expect(result.errors).toContain(scenario.expectedError.message);
       });
     });
   });
   ```

## 📝 Contribution Guidelines

When adding new fixtures:

1. **Follow naming conventions**: Use SCREAMING_SNAKE_CASE for constants
2. **Add to appropriate collections**: Include in relevant category arrays
3. **Document thoroughly**: Add JSDoc comments explaining the purpose
4. **Test compatibility**: Ensure OpenAI API format compliance
5. **Update index.ts**: Export new fixtures from the main index
6. **Update README**: Document new fixtures and usage examples

## 🔗 Related Files

- `/src/tools/types.ts` - TypeScript interfaces
- `/src/tools/schemas.ts` - Zod validation schemas
- `/src/tools/constants.ts` - Validation constants and limits
- `/tests/unit/tools/` - Unit tests using these fixtures
- `/tests/integration/tools/` - Integration tests using these fixtures