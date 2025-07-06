/**
 * Resource Manager - RAII Pattern Implementation
 * Single Responsibility: Track and cleanup all allocated resources
 * Prevents memory leaks by ensuring proper resource lifecycle management
 */

import { EventEmitter } from 'events';
import { getLogger } from './logger';

const logger = getLogger('ResourceManager');

/**
 * Resource types that can be tracked and cleaned up
 */
export type ResourceType = 'timer' | 'interval' | 'listener' | 'signal' | 'emitter' | 'custom';

/**
 * Resource entry for tracking
 */
export interface ResourceEntry {
  id: string;
  type: ResourceType;
  resource: any;
  cleanup: () => void;
  created: Date;
  description?: string;
}

/**
 * Resource statistics
 */
export interface ResourceStats {
  total: number;
  byType: Record<ResourceType, number>;
  oldestResource: Date | null;
  memoryEstimate: number;
}

/**
 * Resource Manager - Implements RAII pattern for automatic resource cleanup
 * Follows SRP: Single responsibility for resource lifecycle management
 */
export class ResourceManager {
  private resources = new Map<string, ResourceEntry>();
  private static instanceCount = 0;
  private readonly instanceId: string;

  constructor(description?: string) {
    ResourceManager.instanceCount++;
    this.instanceId = `rm-${ResourceManager.instanceCount}`;
    logger.debug(`ResourceManager created: ${this.instanceId}${description ? ` (${description})` : ''}`);
  }

  /**
   * Track a timeout and ensure it gets cleaned up
   */
  trackTimeout(callback: () => void, delay: number, description?: string): NodeJS.Timeout {
    const timer = setTimeout(callback, delay);
    this.addResource('timer', timer, () => clearTimeout(timer), description);
    return timer;
  }

  /**
   * Track an interval and ensure it gets cleaned up
   */
  trackInterval(callback: () => void, delay: number, description?: string): NodeJS.Timeout {
    const interval = setInterval(callback, delay);
    this.addResource('interval', interval, () => clearInterval(interval), description);
    return interval;
  }

  /**
   * Track an EventEmitter listener and ensure it gets cleaned up
   */
  trackListener<T extends EventEmitter>(
    emitter: T,
    event: string,
    listener: (...args: any[]) => void,
    description?: string
  ): () => void {
    emitter.on(event, listener);
    const cleanup = () => emitter.removeListener(event, listener);
    this.addResource('listener', { emitter, event, listener }, cleanup, description);
    return cleanup;
  }

  /**
   * Track a process signal handler and ensure it gets cleaned up
   */
  trackSignalHandler(
    signal: NodeJS.Signals,
    handler: (...args: any[]) => void,
    description?: string
  ): () => void {
    // Only add signal handler if not in test environment
    if (!this.isTestEnvironment()) {
      process.on(signal, handler);
    }
    
    const cleanup = () => {
      if (!this.isTestEnvironment()) {
        process.removeListener(signal, handler);
      }
    };
    
    this.addResource('signal', { signal, handler }, cleanup, description);
    return cleanup;
  }

  /**
   * Track an EventEmitter and ensure it gets cleaned up
   */
  trackEmitter(emitter: EventEmitter, description?: string): EventEmitter {
    const cleanup = () => {
      try {
        emitter.removeAllListeners();
        if (typeof (emitter as any).destroy === 'function') {
          (emitter as any).destroy();
        }
      } catch (error) {
        // Prevent infinite recursion during cleanup
        if (error instanceof Error && error.stack && error.stack.includes('ResourceManager.cleanup')) {
          return; // Skip cleanup to break recursion
        }
        throw error;
      }
    };
    this.addResource('emitter', emitter, cleanup, description);
    return emitter;
  }

  /**
   * Track a custom resource with cleanup function
   */
  trackCustom(resource: any, cleanup: () => void, description?: string): string {
    return this.addResource('custom', resource, cleanup, description);
  }

  /**
   * Add a resource to be tracked
   */
  private addResource(
    type: ResourceType,
    resource: any,
    cleanup: () => void,
    description?: string
  ): string {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const entry: ResourceEntry = {
      id,
      type,
      resource,
      cleanup,
      created: new Date(),
      description
    };

    this.resources.set(id, entry);
    logger.debug(`Resource tracked: ${id} (${type})${description ? ` - ${description}` : ''}`);
    
    return id;
  }

  /**
   * Remove and cleanup a specific resource
   */
  removeResource(id: string): boolean {
    const entry = this.resources.get(id);
    if (!entry) {
      return false;
    }

    try {
      entry.cleanup();
      this.resources.delete(id);
      logger.debug(`Resource cleaned up: ${id} (${entry.type})`);
      return true;
    } catch (error) {
      logger.error(`Failed to cleanup resource ${id}:`, error);
      return false;
    }
  }

  private isCleaningUp = false;

  /**
   * Cleanup all tracked resources
   */
  cleanup(): void {
    // Prevent recursive cleanup calls
    if (this.isCleaningUp) {
      return;
    }
    
    this.isCleaningUp = true;
    
    try {
      const startTime = Date.now();
      const resourceCount = this.resources.size;

      if (resourceCount === 0) {
        logger.debug(`ResourceManager ${this.instanceId}: No resources to cleanup`);
        return;
      }

      logger.debug(`ResourceManager ${this.instanceId}: Cleaning up ${resourceCount} resources`);

      let successCount = 0;
      let errorCount = 0;

      for (const [id, entry] of this.resources) {
        try {
          entry.cleanup();
          successCount++;
          logger.debug(`Cleaned up resource: ${id} (${entry.type})`);
        } catch (error) {
          errorCount++;
          logger.error(`Failed to cleanup resource ${id} (${entry.type}):`, error);
        }
      }

      this.resources.clear();

      const duration = Date.now() - startTime;
      logger.info(`ResourceManager ${this.instanceId}: Cleanup completed in ${duration}ms`, {
        total: resourceCount,
        success: successCount,
        errors: errorCount
      });
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Get resource statistics
   */
  getStats(): ResourceStats {
    const byType: Record<ResourceType, number> = {
      timer: 0,
      interval: 0,
      listener: 0,
      signal: 0,
      emitter: 0,
      custom: 0
    };

    let oldestResource: Date | null = null;

    for (const entry of this.resources.values()) {
      byType[entry.type]++;
      if (!oldestResource || entry.created < oldestResource) {
        oldestResource = entry.created;
      }
    }

    return {
      total: this.resources.size,
      byType,
      oldestResource,
      memoryEstimate: this.resources.size * 100 // Rough estimate
    };
  }

  /**
   * Check if running in test environment
   */
  private isTestEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'test' ||
      process.env.JEST_WORKER_ID !== undefined ||
      typeof global.describe === 'function' ||
      typeof (global as any).it === 'function'
    );
  }

  /**
   * Get all resource IDs by type
   */
  getResourceIds(type?: ResourceType): string[] {
    if (!type) {
      return Array.from(this.resources.keys());
    }
    return Array.from(this.resources.values())
      .filter(entry => entry.type === type)
      .map(entry => entry.id);
  }

  /**
   * Check if a resource exists
   */
  hasResource(id: string): boolean {
    return this.resources.has(id);
  }

  /**
   * Get resource count
   */
  getResourceCount(): number {
    return this.resources.size;
  }

  /**
   * Force cleanup and destruction
   */
  destroy(): void {
    this.cleanup();
    logger.debug(`ResourceManager ${this.instanceId}: Destroyed`);
  }
}

/**
 * Global resource manager for application-wide resources
 * Use sparingly - prefer instance-based resource managers
 */
export const globalResourceManager = new ResourceManager('global');

/**
 * Cleanup all global resources (for test cleanup)
 */
export function cleanupGlobalResources(): void {
  globalResourceManager.cleanup();
}

/**
 * Create a new resource manager instance
 */
export function createResourceManager(description?: string): ResourceManager {
  return new ResourceManager(description);
}

/**
 * RAII helper class for automatic cleanup
 * Usage: const guard = new ResourceGuard(resourceManager);
 */
export class ResourceGuard {
  constructor(private manager: ResourceManager) {}

  /**
   * Automatically cleanup resources when guard goes out of scope
   */
  [Symbol.dispose](): void {
    this.manager.cleanup();
  }

  cleanup(): void {
    this.manager.cleanup();
  }
}