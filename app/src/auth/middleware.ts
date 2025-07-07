import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  // TODO: Implement authentication middleware
  next();
};