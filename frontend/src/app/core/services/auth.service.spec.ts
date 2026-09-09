import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService Foundation', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
  });

  it('should initialize with null current user', () => {
    service.clearTokens();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated).toBe(false);
  });

  it('should return false for permissions when user is not authenticated', () => {
    service.clearTokens();
    expect(service.hasPermission('users:read')).toBe(false);
  });
});
