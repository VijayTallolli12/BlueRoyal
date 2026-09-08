export interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: ErrorDetail[];

  constructor(
    message: string,
    statusCode = 500,
    errorCode = 'INTERNAL_ERROR',
    isOperational = true,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(message: string, details?: ErrorDetail[]): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', true, details);
  }

  public static notFound(message: string): AppError {
    return new NotFoundError(message);
  }

  public static conflict(message: string): AppError {
    return new ConflictError(message);
  }

  public static unauthorized(message = 'Authentication required'): AppError {
    return new AuthenticationError(message);
  }

  public static forbidden(message = 'Access denied: insufficient permissions'): AppError {
    return new AuthorizationError(message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: ErrorDetail[]) {
    super(message, 422, 'VALIDATION_FAILED', true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied: insufficient permissions') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT', true);
  }
}
