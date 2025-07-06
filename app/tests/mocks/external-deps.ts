/**
 * External Dependencies Mock
 * Mocks for external libraries and APIs
 */

// Mock fetch for API calls
export const mockFetch = jest.fn();

// Mock logger
export const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock file system operations
export const mockFs = {
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('mock file content'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn().mockReturnValue([]),
};

// Mock OS operations
export const mockOs = {
  homedir: jest.fn().mockReturnValue('/mock/home'),
  platform: jest.fn().mockReturnValue('linux'),
  tmpdir: jest.fn().mockReturnValue('/tmp'),
};

// Mock path operations
export const mockPath = {
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  resolve: jest.fn().mockImplementation((...args) => '/' + args.join('/')),
  dirname: jest.fn().mockReturnValue('/mock/dir'),
  basename: jest.fn().mockReturnValue('mock-file'),
};

// Mock crypto operations
export const mockCrypto = {
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mockedrandom', 'hex')),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mockedhash'),
  }),
};

// Setup global mocks
export const setupGlobalMocks = () => {
  global.fetch = mockFetch;
  
  // Mock successful fetch responses by default
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ message: 'mock response' }),
    text: jest.fn().mockResolvedValue('mock text response'),
  });
};

// Cleanup global mocks
export const cleanupGlobalMocks = () => {
  jest.restoreAllMocks();
};