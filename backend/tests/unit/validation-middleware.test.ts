import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../src/core/middleware/validate.middleware';

describe('Validation Middleware', () => {
  const schema = {
    body: z.object({
      email: z.string().email(),
      age: z.number().min(18),
    }),
  };

  it('should pass validation when body satisfies schema', async () => {
    const req = {
      body: { email: 'test@blueroyal.com', age: 25 },
    } as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;

    await validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next with validation error when body is invalid', async () => {
    const req = {
      body: { email: 'invalid-email', age: 15 },
    } as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;

    await validate(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    const errorPassed = (next as jest.Mock).mock.calls[0][0];
    expect(errorPassed).toBeInstanceOf(z.ZodError);
  });
});
