import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Await session restoration before evaluating route activation
  await authService.ensureInitialized();

  if (authService.isAuthenticated || authService.getAccessToken()) {
    return true;
  }

  // Preserve requested destination for post-login return
  const queryParams =
    state.url && state.url !== '/' && state.url !== '/dashboard'
      ? { returnUrl: state.url }
      : {};

  router.navigate(['/login'], { queryParams });
  return false;
};
