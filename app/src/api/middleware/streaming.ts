import { Request, Response, NextFunction } from 'express';

export const streamingMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};