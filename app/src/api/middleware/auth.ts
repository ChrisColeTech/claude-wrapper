import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};