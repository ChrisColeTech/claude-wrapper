/**
 * FS Mock for Testing
 * Provides controlled file system operations for tests
 */

export const mockExistsSync = jest.fn();
export const mockReadFileSync = jest.fn();
export const mockWriteFileSync = jest.fn();
export const mockMkdirSync = jest.fn();
export const mockStatSync = jest.fn();
export const mockReaddirSync = jest.fn();

// Mock implementations
export const mockFsImpl = {
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
  statSync: mockStatSync,
  readdirSync: mockReaddirSync,
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
  }
};

// Reset function for easy cleanup
export const resetFsMocks = () => {
  mockExistsSync.mockReset();
  mockReadFileSync.mockReset();
  mockWriteFileSync.mockReset();
  mockMkdirSync.mockReset();
  mockStatSync.mockReset();
  mockReaddirSync.mockReset();
  
  // Set default behaviors
  mockExistsSync.mockReturnValue(false);
  mockReadFileSync.mockReturnValue('');
  mockReaddirSync.mockReturnValue([]);
};

export default mockFsImpl;