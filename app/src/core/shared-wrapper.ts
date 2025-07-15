/**
 * Shared CoreWrapper instance for consistent session management
 * Ensures all routes use the same CoreWrapper instance to share optimized sessions
 */

import { CoreWrapper } from './wrapper';

// Create singleton CoreWrapper instance configured for optimized sessions
const sharedCoreWrapper = new CoreWrapper();

export { sharedCoreWrapper };