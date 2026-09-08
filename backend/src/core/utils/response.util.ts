import { Request, Response } from 'express';
import { ApiSuccessResponse, PaginationMeta } from '@blue-royal/contracts';

export function sendSuccess<T>(
  req: Request,
  res: Response,
  data: T,
  statusCode = 200,
  pagination?: PaginationMeta,
): Response {
  const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';

  const responseBody: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta: {
      correlationId,
      timestamp: new Date().toISOString(),
      ...(pagination ? { pagination } : {}),
    },
  };

  return res.status(statusCode).json(responseBody);
}
