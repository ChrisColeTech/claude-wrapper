import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { logger } from './logger';

export class TempFileManager {
  private static tempDir = '/tmp/claude-wrapper';
  
  /**
   * Creates a temporary file with the given content
   * @param content - The content to write to the temporary file
   * @returns Promise resolving to the temporary file path
   */
  static async createTempFile(content: string): Promise<string> {
    try {
      await this.ensureTempDirectory();
      
      const fileName = `prompt-${randomBytes(8).toString('hex')}.txt`;
      const filePath = path.join(this.tempDir, fileName);
      
      // Write content to temp file with restricted permissions
      await fs.writeFile(filePath, content, { 
        mode: 0o600, // Read/write for owner only
        encoding: 'utf8'
      });
      
      logger.debug('Created temporary file', { 
        filePath, 
        contentLength: content.length,
        fileName 
      });
      
      return filePath;
    } catch (error) {
      logger.error('Failed to create temporary file', error as Error);
      throw new Error(`Failed to create temporary file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Cleans up a temporary file
   * @param filePath - The path to the temporary file to remove
   */
  static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug('Cleaned up temporary file', { filePath });
    } catch (error) {
      // Non-blocking cleanup - log warning but don't throw
      logger.warn('Failed to cleanup temporary file', { 
        filePath, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Startup cleanup - removes old temp files from previous runs
   */
  static async cleanupOnStartup(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const tempFiles = files.filter(file => 
        file.startsWith('prompt-') && file.endsWith('.txt')
      );
      
      if (tempFiles.length > 0) {
        const cleanupPromises = tempFiles.map(file => 
          this.cleanupTempFile(path.join(this.tempDir, file))
        );
        await Promise.all(cleanupPromises);
        logger.info('Startup cleanup completed', { 
          cleanedFiles: tempFiles.length 
        });
      }
    } catch (error) {
      logger.warn('Startup cleanup failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  /**
   * Ensures the temporary directory exists
   */
  static async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { 
        recursive: true,
        mode: 0o700 // Read/write/execute for owner only
      });
    } catch (error) {
      // If directory already exists, that's fine
      if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
        logger.error('Failed to create temporary directory', error);
        throw new Error(`Failed to create temporary directory: ${error.message}`);
      }
    }
  }
  
  /**
   * Cleanup all temporary files (for graceful shutdown)
   */
  static async cleanupAllTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir);
      const cleanupPromises = files
        .filter(file => file.startsWith('prompt-') && file.endsWith('.txt'))
        .map(file => this.cleanupTempFile(path.join(this.tempDir, file)));
      
      await Promise.all(cleanupPromises);
      logger.debug('Cleaned up all temporary files', { fileCount: cleanupPromises.length });
    } catch (error) {
      logger.warn('Failed to cleanup all temporary files', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  /**
   * Get the temporary directory path
   */
  static getTempDirectory(): string {
    return this.tempDir;
  }
  
  /**
   * Check if a file path is a temp file created by this manager
   */
  static isTempFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath);
    return dirName === this.tempDir && 
           fileName.startsWith('prompt-') && 
           fileName.endsWith('.txt');
  }
}