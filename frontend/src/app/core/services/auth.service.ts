import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
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

  // Signals for modern Angular reactivity
  public currentUser = signal<UserProfileDto | null>(null);
  public isAuthenticated = computed(() => this.currentUser() !== null);

  constructor(private http: HttpClient) {
    this.restoreSession();
  }

  public getAccessToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  public setAccessToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  public clearTokens(): void {
    localStorage.removeItem(this.tokenKey);
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

  private restoreSession(): void {
    const token = this.getAccessToken();
    if (token) {
      this.fetchProfile().subscribe({
        error: () => this.clearTokens(),
      });
    }
  }
}
