import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} from '../../src/core/errors/app-error';

describe('AppError Hierarchy', () => {
  it('should instantiate ValidationError with status 422 and correct error code', () => {
    const error = new ValidationError('Invalid email address', [
      { field: 'email', message: 'Format error' },
    ]);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(422);
    expect(error.errorCode).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('Invalid email address');
    expect(error.details).toHaveLength(1);
    expect(error.isOperational).toBe(true);
  });

  it('should instantiate AuthenticationError with status 401', () => {
    const error = new AuthenticationError('Token required');
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe('UNAUTHORIZED');
  });

  it('should instantiate AuthorizationError with status 403', () => {
    const error = new AuthorizationError('Insufficient permissions');
    expect(error.statusCode).toBe(403);
    expect(error.errorCode).toBe('FORBIDDEN');
  });

  it('should instantiate NotFoundError with status 404', () => {
    const error = new NotFoundError('Resource not found');
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe('NOT_FOUND');
  });

  it('should instantiate ConflictError with status 409', () => {
    const error = new ConflictError('Unique constraint violated');
    expect(error.statusCode).toBe(409);
    expect(error.errorCode).toBe('CONFLICT');
  });
});
