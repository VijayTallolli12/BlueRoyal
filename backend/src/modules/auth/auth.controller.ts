import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess } from '../../core/utils/response.util';
import { env } from '../../config/env';

export class AuthController {
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const correlationId = req.headers['x-correlation-id'] as string;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login(email, password, { ip, userAgent, correlationId });

      // Set refresh token in secure HttpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: env.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      });

      sendSuccess(
        req,
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  public static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      const correlationId = req.headers['x-correlation-id'] as string;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.refreshSession(refreshToken, {
        ip,
        userAgent,
        correlationId,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: env.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      });

      sendSuccess(
        req,
        res,
        {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      const correlationId = req.headers['x-correlation-id'] as string;
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const userId = req.user?.id;

      await AuthService.logout(refreshToken, userId, { ip, userAgent, correlationId });

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
      });

      sendSuccess(req, res, { message: 'Logged out successfully.' }, 200);
    } catch (error) {
      next(error);
    }
  }

  public static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await AuthService.getUserProfile(req.user!.id);
      sendSuccess(req, res, profile, 200);
    } catch (error) {
      next(error);
    }
  }
}
