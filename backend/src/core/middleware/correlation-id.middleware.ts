import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingCorrelationId = req.headers['x-correlation-id'] as string;
  const correlationId = existingCorrelationId || uuidv4();

  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}
