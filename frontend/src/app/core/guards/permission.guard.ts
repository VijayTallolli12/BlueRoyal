import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const permissionGuard: CanActivateFn = async (route: ActivatedRouteSnapshot, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Await session restoration so permissions are fully populated
  await authService.ensureInitialized();

  // If unauthenticated, redirect to login
  if (!authService.isAuthenticated) {
    const queryParams =
      state.url && state.url !== '/' && state.url !== '/dashboard'
        ? { returnUrl: state.url }
        : {};
    router.navigate(['/login'], { queryParams });
    return false;
  }

  const requiredPermission = route.data['permission'] as string;
  if (!requiredPermission) {
    return true;
  }

  if (authService.hasPermission(requiredPermission)) {
  if (authService.hasRole('super_admin') || authService.hasPermission(requiredPermission)) {
    return true;
  }

  // Access denied - authenticated user lacks specific permission
  console.warn(`[PermissionGuard] Access denied for route '${state.url}': missing permission '${requiredPermission}'`);
  router.navigate(['/dashboard']);
  return false;
};
