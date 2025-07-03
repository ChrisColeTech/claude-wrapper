🎭 Mocks vs Stubs vs Shims

MOCKS - Verify Behavior & Interactions

Purpose: Track how functions are called and verify interactions

What they do: Record calls, parameters, return values, and allow assertions on behavior

// ✅ MOCK Example from our CLI integration test

const mockCreateAndStartServer = createAndStartServer as jest.MockedFunction&lt;typeof createAndStartServer&gt;;

// Mock tracks calls and allows behavior verification

mockCreateAndStartServer.mockResolvedValue({

server: { close: jest.fn() },

port: 8000,

url: '<http://localhost:8000>'

});

// Test the interaction behavior

await runner.run(\['node', 'cli.js', '--port', '9000'\]);

// VERIFY the mock was called correctly

expect(mockCreateAndStartServer).toHaveBeenCalledTimes(1);

expect(mockCreateAndStartServer).toHaveBeenCalledWith(expect.any(Object));

STUBS - Replace Dependencies with Predictable Responses

Purpose: Provide controlled responses without side effects

What they do: Return predetermined values, no behavior verification

// ✅ STUB Example from our server tests

// Stub winston to avoid console output during tests

jest.mock('winston', () => ({

createLogger: jest.fn(() => ({

info: jest.fn(), // Stub - just returns nothing

debug: jest.fn(), // Stub - just returns nothing

error: jest.fn(), // Stub - just returns nothing

warn: jest.fn() // Stub - just returns nothing

})),

format: {

combine: jest.fn(() => ({})), // Stub - returns empty object

timestamp: jest.fn(() => ({})), // Stub - returns empty object

errors: jest.fn(() => ({})) // Stub - returns empty object

}

}));

// We don't care HOW logging is called, just that it doesn't break our tests

SHIMS - Compatibility Layers for Missing APIs

Purpose: Provide missing functionality or adapt interfaces

What they do: Fill gaps in APIs or provide compatibility

// ✅ SHIM Example - Adapting Node.js for browser-like APIs

// If we needed to test browser code in Node.js environment

const fetchShim = async (url: string): Promise&lt;Response&gt; => {

// Shim fetch API for Node.js using node-fetch or similar

const http = require('http');

return new Promise((resolve) => {

// Implementation that makes Node.js behave like browser

});

};

// Another example - polyfill for missing methods

if (!Array.prototype.includes) {

Array.prototype.includes = function(searchElement) {

return this.indexOf(searchElement) !== -1;

};

}

🎯 When to Use Each

Use MOCKS when:

\- Testing interactions between components

\- Verifying how many times functions are called

\- Checking what parameters were passed

\- Testing error handling flows

// ✅ Perfect Mock Usage - Testing CLI error handling

it('should handle server startup errors gracefully', async () => {

// Mock server startup failure

mockCreateAndStartServer.mockRejectedValue(new Error('Port already in use'));

await runner.run(\['node', 'cli.js'\]);

// VERIFY error handling behavior

expect(mockConsoleError).toHaveBeenCalledWith(

expect.stringMatching(/❌.\*Failed to start server.\*/)

);

expect(mockExit).toHaveBeenCalledWith(1);

});

Use STUBS when:

\- Replacing external dependencies (databases, APIs, file systems)

\- Providing predictable responses without side effects

\- Isolating the unit under test

\- Making tests fast and reliable

// ✅ Perfect Stub Usage - Database replacement

const stubSessionStore = {

create: () => Promise.resolve({ id: 'test-session', model: 'claude-3-5-sonnet' }),

retrieve: () => Promise.resolve({ id: 'test-session', messages: \[\] }),

delete: () => Promise.resolve(true),

clear: () => Promise.resolve()

};

// We don't care HOW the database works, just that it returns what we need

Use SHIMS when:

\- Polyfilling missing browser/Node.js APIs

\- Adapting between different API versions

\- Providing compatibility across environments

\- Translating between different interfaces

// ✅ Perfect Shim Usage - Making Node.js tests work with browser APIs

const localStorageShim = {

getItem: (key: string) => process.env\[\`STORAGE\_${key}\`\] || null,

setItem: (key: string, value: string) => { process.env\[\`STORAGE\_${key}\`\] = value; },

removeItem: (key: string) => { delete process.env\[\`STORAGE\_${key}\`\]; }

};

global.localStorage = localStorageShim;

🚀 Best Practices from Our Phase 1 Tests

1\. Prefer Stubs for External Dependencies

// ✅ GOOD - Stub the entire Winston module

jest.mock('winston', () => ({ /\* stub implementation \*/ }));

// ❌ BAD - Using real Winston (slow, console pollution)

import winston from 'winston';

const logger = winston.createLogger({ /\* real config \*/ });

2\. Use Mocks for Behavior Testing

// ✅ GOOD - Mock to verify function calls

const mockCreateServer = jest.fn();

expect(mockCreateServer).toHaveBeenCalledWith(expectedConfig);

// ❌ BAD - Stub when you need to verify behavior

const stubCreateServer = () => ({ listen: () => {} }); // Can't verify calls

3\. Keep Tests Fast with Proper Isolation

// ✅ GOOD - No real I/O, fast tests

const mockPortCheck = jest.fn().mockResolvedValue({ available: true });

// ❌ BAD - Real network calls, slow tests

const realPortCheck = async (port) => {

const server = require('net').createServer();

return new Promise(/\* real port checking \*/);

};

4\. Clear Mocks Between Tests

// ✅ GOOD - Clean state for each test

beforeEach(() => {

jest.clearAllMocks();

});

// ❌ BAD - Tests contaminate each other

// No cleanup between tests

📊 Summary Table

| Type | Purpose | Example Use Case | Our Tests

|

|------|----------------------|--------------------------------------------|-------------------------------------

\--------------|

| Mock | Verify interactions | "Was createServer called with port 8000?" | CLI integration test mocking

createAndStartServer |

| Stub | Replace dependencies | "Return fake user data instead of DB call" | Winston logger stub to avoid console

output |

| Shim | Compatibility layer | "Make fetch work in Node.js tests" | Not needed in our current Phase 1

tests |
