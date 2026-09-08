import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        // Token expired or invalid
        authService.clearTokens();
        router.navigate(['/login']);
      }

      const errorMessage =
        error.error?.error?.message || error.message || 'An unexpected error occurred.';
      console.error(`[API Error ${error.status}]: ${errorMessage}`, error.error);

      return throwError(() => error);
    }),
  );
};
