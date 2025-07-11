import { TempFileManager } from '../../../src/utils/temp-file-manager';
import { promises as fs } from 'fs';
import path from 'path';

describe('TempFileManager', () => {
  afterEach(async () => {
    // Cleanup any temp files after each test
    await TempFileManager.cleanupAllTempFiles();
  });

  describe('createTempFile', () => {
    it('should create a temporary file with content', async () => {
      const content = 'test content';
      const filePath = await TempFileManager.createTempFile(content);
      
      expect(filePath).toBeTruthy();
      expect(TempFileManager.isTempFile(filePath)).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(content);
    });

    it('should create unique file names', async () => {
      const file1 = await TempFileManager.createTempFile('content1');
      const file2 = await TempFileManager.createTempFile('content2');
      
      expect(file1).not.toBe(file2);
      expect(path.basename(file1)).not.toBe(path.basename(file2));
    });

    it('should handle large content', async () => {
      const largeContent = 'x'.repeat(100 * 1024); // 100KB
      const filePath = await TempFileManager.createTempFile(largeContent);
      
      const fileContent = await fs.readFile(filePath, 'utf8');
      expect(fileContent).toBe(largeContent);
      expect(fileContent.length).toBe(100 * 1024);
    });
  });

  describe('cleanupTempFile', () => {
    it('should remove temporary file', async () => {
      const filePath = await TempFileManager.createTempFile('test');
      
      // Verify file exists
      const statsBefore = await fs.stat(filePath);
      expect(statsBefore.isFile()).toBe(true);
      
      // Cleanup
      await TempFileManager.cleanupTempFile(filePath);
      
      // Verify file is removed
      await expect(fs.stat(filePath)).rejects.toThrow();
    });

    it('should not throw on non-existent file', async () => {
      const nonExistentPath = '/tmp/claude-wrapper/non-existent-file.txt';
      await expect(TempFileManager.cleanupTempFile(nonExistentPath)).resolves.not.toThrow();
    });
  });

  describe('isTempFile', () => {
    it('should correctly identify temp files', async () => {
      const tempFile = await TempFileManager.createTempFile('test');
      expect(TempFileManager.isTempFile(tempFile)).toBe(true);
      
      expect(TempFileManager.isTempFile('/some/other/path.txt')).toBe(false);
      expect(TempFileManager.isTempFile('/tmp/claude-wrapper/not-a-prompt-file.txt')).toBe(false);
    });
  });

  describe('getTempDirectory', () => {
    it('should return temp directory path', () => {
      const tempDir = TempFileManager.getTempDirectory();
      expect(tempDir).toBe('/tmp/claude-wrapper');
    });
  });

  describe('cleanupAllTempFiles', () => {
    it('should cleanup multiple temp files', async () => {
      const file1 = await TempFileManager.createTempFile('content1');
      const file2 = await TempFileManager.createTempFile('content2');
      
      // Verify files exist
      expect(await fs.stat(file1)).toBeTruthy();
      expect(await fs.stat(file2)).toBeTruthy();
      
      // Cleanup all
      await TempFileManager.cleanupAllTempFiles();
      
      // Verify files are removed
      await expect(fs.stat(file1)).rejects.toThrow();
      await expect(fs.stat(file2)).rejects.toThrow();
    });
  });
});