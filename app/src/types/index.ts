/**
 * Core type definitions
 * Based on Python models.py structures
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

export interface RequestWithAuth extends Request {
  user?: {
    apiKey: string;
  };
}
