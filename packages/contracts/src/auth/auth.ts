export type ConfirmedRoleName = 'super_admin' | 'hr_admin' | 'employee';

export interface RoleDto {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions?: string[];
}

export interface UserProfileDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  user: UserProfileDto;
  accessToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequestDto {
  refreshToken?: string; // Optional in body if transported via secure HttpOnly cookie
}

export interface RefreshTokenResponseDto {
  accessToken: string;
  expiresIn: number;
}
