import { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '../errors/app-error';

export function requirePermission(permissionCode: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthorizationError('Unauthenticated request cannot be authorized.'));
    }

    // Super Admin has unrestricted bypass
    if (req.user.roles.includes('super_admin')) {
      return next();
    }

    // Check if user has explicit permission
    if (req.user.permissions && req.user.permissions.includes(permissionCode)) {
      return next();
    }

    return next(
      new AuthorizationError(
        `User does not possess required permission "${permissionCode}" to access this resource.`,
      ),
    );
  };
}

export function requireAnyRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthorizationError('Unauthenticated request cannot be authorized.'));
    }

    if (req.user.roles.includes('super_admin')) {
      return next();
    }

    const hasMatchingRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (hasMatchingRole) {
      return next();
    }

    return next(
      new AuthorizationError('User role does not meet the requirements for this action.'),
    );
  };
}
