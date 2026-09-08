import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiErrorResponse } from '@blue-royal/contracts';
import { AppError } from '../errors/app-error';
import { logger } from '../logger/logger';
import { env } from '../../config/env';

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred.';
  let details: any[] | undefined = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 422;
    errorCode = 'VALIDATION_FAILED';
    message = 'Request validation failed.';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Authentication token is invalid.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired.';
  }

  // Log error with correlation context
  if (statusCode >= 500) {
    logger.error(`[${statusCode}] ${req.method} ${req.originalUrl} - ${err.message}`, {
      correlationId,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn(`[${statusCode}] ${req.method} ${req.originalUrl} - ${message}`, {
      correlationId,
      errorCode,
      details,
    });
  }

  const responseBody: ApiErrorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
      ...(env.NODE_ENV !== 'production' && statusCode >= 500
        ? { details: [{ message: err.stack }] }
        : {}),
    },
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
    },
  };

  return res.status(statusCode).json(responseBody);
}
