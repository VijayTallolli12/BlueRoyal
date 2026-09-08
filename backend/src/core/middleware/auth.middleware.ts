import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AuthenticationError } from '../errors/app-error';
import { AuthService, TokenPayload } from '../../modules/auth/auth.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AuthenticationError('Authentication token not provided.');
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;

    // Load full profile with fresh permissions
    const profile = await AuthService.getUserProfile(decoded.userId);
    if (!profile.isActive) {
      throw new AuthenticationError('User account is inactive or disabled.');
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      roles: profile.roles,
      permissions: profile.permissions,
    };

    next();
  } catch (error) {
    next(error);
  }
}
