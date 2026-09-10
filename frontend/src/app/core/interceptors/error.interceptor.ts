import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // 1. Login endpoint 401 (invalid credentials): let login component handle it
        if (req.url.includes('/auth/login')) {
          return throwError(() => error);
        }

        // 2. Refresh endpoint 401 (session revoked or expired): log out user
        if (req.url.includes('/auth/refresh')) {
          authService.clearTokens();
          router.navigate(['/login']);
          return throwError(() => error);
        }

        // 3. If this request was already retried with a refreshed token, prevent loop
        if (req.headers.has('X-Refresh-Retried')) {
          authService.clearTokens();
          router.navigate(['/login']);
          return throwError(() => error);
        }

        // 4. Protected API 401 (access token expired): attempt silent refresh and replay request
        return authService.refreshTokenSilently().pipe(
          switchMap((newToken) => {
            const retriedReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken}`,
                'X-Refresh-Retried': 'true',
              },
            });
            return next(retriedReq);
          }),
          catchError((refreshErr) => {
            // Refresh failed (e.g. cookie expired or invalid)
            authService.clearTokens();
            router.navigate(['/login']);
            return throwError(() => refreshErr);
          }),
        );
      }

      const errorMessage =
        error.error?.error?.message || error.message || 'An unexpected error occurred.';
      console.error(`[API Error ${error.status}]: ${errorMessage}`, error.error);

      return throwError(() => error);
    }),
  );
};
