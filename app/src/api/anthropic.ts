import { randomUUID } from 'crypto';

export function isAnthropicMessagesPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return normalized === '/v1/messages' || normalized === '/v1/messages/';
}

export function anthropicError(type: string, message: string) {
  return {
    type: 'error' as const,
    error: { type, message },
    request_id: `req_${randomUUID().replace(/-/g, '')}`
  };
}
