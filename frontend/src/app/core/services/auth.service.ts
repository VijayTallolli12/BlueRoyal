import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, firstValueFrom, map, finalize, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  UserProfileDto,
  LoginResponseDto,
  ApiSuccessResponse,
  RefreshTokenResponseDto,
} from '@blue-royal/contracts';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly tokenKey = 'br_access_token';
  private readonly userKey = 'br_user_profile';

  // In-flight refresh lock to prevent concurrent duplicate refresh requests
  private refreshInProgress$: Observable<string> | null = null;
  private initPromise: Promise<void> | null = null;

  // Signals for modern Angular reactivity
  public currentUser = signal<UserProfileDto | null>(this.getStoredUser());
  public isInitialized = signal<boolean>(false);

  public get isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  constructor(private http: HttpClient) {}

  public getAccessToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  public setAccessToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  public getStoredUser(): UserProfileDto | null {
    try {
      const stored = localStorage.getItem(this.userKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  public setStoredUser(user: UserProfileDto | null): void {
    if (user) {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.userKey);
    }
  }

  public clearTokens(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUser.set(null);
  }

  public login(
    email: string,
    passwordPlain: string,
  ): Observable<ApiSuccessResponse<LoginResponseDto>> {
    return this.http
      .post<ApiSuccessResponse<LoginResponseDto>>(
        `${environment.apiUrl}/auth/login`,
        { email, password: passwordPlain },
        { withCredentials: true },
      )
      .pipe(
        tap((response) => {
          this.setAccessToken(response.data.accessToken);
          this.setStoredUser(response.data.user);
          this.currentUser.set(response.data.user);
        }),
      );
  }

  public refresh(): Observable<ApiSuccessResponse<RefreshTokenResponseDto>> {
    return this.http
      .post<ApiSuccessResponse<RefreshTokenResponseDto>>(
        `${environment.apiUrl}/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(
        tap((response) => {
          this.setAccessToken(response.data.accessToken);
        }),
      );
  }

  /**
   * Thread-safe silent refresh with in-flight request sharing to prevent
   * concurrent token rotation conflicts.
   */
  public refreshTokenSilently(): Observable<string> {
    if (this.refreshInProgress$) {
      return this.refreshInProgress$;
    }

    this.refreshInProgress$ = this.refresh().pipe(
      map((res) => res.data.accessToken),
      shareReplay(1),
      finalize(() => {
        this.refreshInProgress$ = null;
      }),
    );

    return this.refreshInProgress$;
  }

  public logout(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => this.clearTokens()),
      catchError((err) => {
        this.clearTokens();
        return throwError(() => err);
      }),
    );
  }

  public fetchProfile(): Observable<ApiSuccessResponse<UserProfileDto>> {
    return this.http.get<ApiSuccessResponse<UserProfileDto>>(`${environment.apiUrl}/auth/me`).pipe(
      tap((response) => {
        this.setStoredUser(response.data);
        this.currentUser.set(response.data);
      }),
    );
  }

  public hasPermission(permissionCode: string): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.roles.includes('super_admin')) return true;
    return user.permissions.includes(permissionCode);
  }

  public hasRole(roleName: string): boolean {
    const user = this.currentUser();
    if (!user) return false;
    return user.roles.includes(roleName);
  }

  /**
   * Application bootstrap session restoration.
   * Runs before routing begins via APP_INITIALIZER.
   */
  public initAuth(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.performAuthInit();
    return this.initPromise;
  }

  private async performAuthInit(): Promise<void> {
    try {
      const token = this.getAccessToken();
      if (token) {
        // Token exists, attempt to verify session with fresh profile
        try {
          await firstValueFrom(this.fetchProfile());
        } catch (err: any) {
          // If token expired (401), attempt silent refresh via HttpOnly cookie
          if (err?.status === 401) {
            try {
              await firstValueFrom(this.refreshTokenSilently());
              await firstValueFrom(this.fetchProfile());
            } catch {
              // Refresh failed or revoked; clear session
              this.clearTokens();
            }
          } else {
            console.warn('[AuthService] Profile verification warning:', err?.message || err);
          }
        }
      } else {
        // No access token in storage; check if we have a valid HttpOnly refresh cookie
        try {
          await firstValueFrom(this.refreshTokenSilently());
          await firstValueFrom(this.fetchProfile());
        } catch {
          this.clearTokens();
        }
      }
    } finally {
      this.isInitialized.set(true);
    }
  }

  /**
   * Ensures authentication hydration is complete before route guards make decisions.
   */
  public async ensureInitialized(): Promise<void> {
    if (this.isInitialized()) {
      return;
    }
    await this.initAuth();
  }
}
