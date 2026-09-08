import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { User, Role, Permission, RefreshToken } from './models';
import { AuthenticationError, NotFoundError } from '../../core/errors/app-error';
import { AuditService } from '../../core/audit/audit.service';
import { UserProfileDto } from '@blue-royal/contracts';

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface AuthSessionResult {
  user: UserProfileDto;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private static generateTokens(
    user: User,
    roles: Role[],
  ): {
    accessToken: string;
    rawRefreshToken: string;
    tokenHash: string;
    expiresIn: number;
  } {
    const roleNames = roles.map((r) => r.name);
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      roles: roleNames,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRATION as any,
    });

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    return {
      accessToken,
      rawRefreshToken,
      tokenHash,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  public static async login(
    email: string,
    passwordPlain: string,
    meta: { ip?: string; userAgent?: string; correlationId?: string },
  ): Promise<AuthSessionResult> {
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      include: [
        {
          model: Role,
          as: 'roles',
          include: [{ model: Permission, as: 'permissions' }],
        },
      ],
    });

    if (!user || !user.isActive) {
      await AuditService.recordEvent({
        actorIp: meta.ip,
        actorUserAgent: meta.userAgent,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        oldValues: { email },
        correlationId: meta.correlationId,
      });
      throw new AuthenticationError('Invalid email or password.');
    }

    const passwordMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!passwordMatch) {
      await AuditService.recordEvent({
        actorId: user.id,
        actorIp: meta.ip,
        actorUserAgent: meta.userAgent,
        action: 'LOGIN_FAILED',
        resourceType: 'User',
        resourceId: user.id,
        correlationId: meta.correlationId,
      });
      throw new AuthenticationError('Invalid email or password.');
    }

    const roles = user.roles || [];
    const permissionsSet = new Set<string>();
    roles.forEach((r: any) => {
      r.permissions?.forEach((p: any) => permissionsSet.add(p.code));
    });

    const { accessToken, rawRefreshToken, tokenHash, expiresIn } = this.generateTokens(user, roles);

    // Save refresh token record
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + env.JWT_REFRESH_EXPIRATION_DAYS);

    await RefreshToken.create({
      userId: user.id,
      tokenHash,
      expiresAt: refreshExpiresAt,
    } as any);

    await AuditService.recordEvent({
      actorId: user.id,
      actorIp: meta.ip,
      actorUserAgent: meta.userAgent,
      action: 'LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user.id,
      correlationId: meta.correlationId,
    });

    const userProfile: UserProfileDto = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles: roles.map((r) => r.name),
      permissions: Array.from(permissionsSet),
    };

    return {
      user: userProfile,
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn,
    };
  }

  public static async refreshSession(
    rawRefreshToken: string,
    meta: { ip?: string; userAgent?: string; correlationId?: string },
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    if (!rawRefreshToken) {
      throw new AuthenticationError('Refresh token is required.');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const existingToken = await RefreshToken.findOne({
      where: { tokenHash },
      include: [
        {
          model: User,
          as: 'user',
          include: [{ model: Role, as: 'roles' }],
        },
      ],
    });

    if (!existingToken || existingToken.revokedAt || new Date() > existingToken.expiresAt) {
      throw new AuthenticationError('Refresh token is invalid or has expired.');
    }

    const user = (existingToken as any).user as User;
    if (!user || !user.isActive) {
      throw new AuthenticationError('Associated user is inactive or not found.');
    }

    // Revoke previous token (Token Rotation)
    existingToken.revokedAt = new Date();
    await existingToken.save();

    const roles = user.roles || [];
    const {
      accessToken,
      rawRefreshToken: newRawRefreshToken,
      tokenHash: newTokenHash,
      expiresIn,
    } = this.generateTokens(user, roles);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + env.JWT_REFRESH_EXPIRATION_DAYS);

    await RefreshToken.create({
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt: refreshExpiresAt,
    } as any);

    await AuditService.recordEvent({
      actorId: user.id,
      actorIp: meta.ip,
      actorUserAgent: meta.userAgent,
      action: 'TOKEN_REFRESH',
      resourceType: 'User',
      resourceId: user.id,
      correlationId: meta.correlationId,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn,
    };
  }

  public static async logout(
    rawRefreshToken: string | undefined,
    userId: string | undefined,
    meta: { ip?: string; userAgent?: string; correlationId?: string },
  ): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      const token = await RefreshToken.findOne({ where: { tokenHash } });
      if (token && !token.revokedAt) {
        token.revokedAt = new Date();
        await token.save();
      }
    }

    if (userId) {
      await AuditService.recordEvent({
        actorId: userId,
        actorIp: meta.ip,
        actorUserAgent: meta.userAgent,
        action: 'LOGOUT',
        resourceType: 'User',
        resourceId: userId,
        correlationId: meta.correlationId,
      });
    }
  }

  public static async getUserProfile(userId: string): Promise<UserProfileDto> {
    const user = await User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: 'roles',
          include: [{ model: Permission, as: 'permissions' }],
        },
      ],
    });

    if (!user) {
      throw new NotFoundError('User profile not found.');
    }

    const roles = user.roles || [];
    const permissionsSet = new Set<string>();
    roles.forEach((r: any) => {
      r.permissions?.forEach((p: any) => permissionsSet.add(p.code));
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      roles: roles.map((r) => r.name),
      permissions: Array.from(permissionsSet),
    };
  }
}
