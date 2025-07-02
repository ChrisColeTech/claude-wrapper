// Error response models - To be implemented in Phase 12
// Based on Python models.py:146-154
export interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: string;
  };
}
