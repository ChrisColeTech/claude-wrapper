import { Request, Response, NextFunction } from 'express';

export const sessionMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};