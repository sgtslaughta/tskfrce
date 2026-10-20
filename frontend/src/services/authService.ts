/**
 * @fileoverview Authentication Service for TaaskMaaster
 * @description Service for handling authentication with the backend API
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { apiGet, apiPost } from './api';
import { saveLoginState, clearLoginState, getLoginState } from '../utils/cookies';
import { tokenManager } from './tokenManager';

/**
 * @description Login request interface
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * @description Login response interface
 */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
}

/**
 * @description Refresh token request interface
 */
export interface RefreshTokenRequest {
  refresh_token: string;
}

/**
 * @description Refresh token response interface
 */
export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * @description Logout response interface
 */
export interface LogoutResponse {
  message: string;
}

/**
 * @description Current user information interface
 */
export interface CurrentUser {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_superuser: boolean;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * @description Authentication service class
 */
export class AuthService {
  private static instance: AuthService;
  private currentUser: CurrentUser | null = null;

  /**
   * @description Get singleton instance
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * @description Login user with credentials
   * @param credentials - Login credentials
   * @returns Promise with login response
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await apiPost<LoginResponse>('/auth/login', credentials);
      
      // Use TokenManager to securely store tokens
      tokenManager.setTokens({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in || 3600,
        refresh_expires_in: response.data.refresh_expires_in,
      }, {
        userId: response.data.user_id.toString(),
        username: response.data.username,
        email: response.data.email,
        role: response.data.role,
      });
      
      // Store user info
      this.currentUser = {
        user_id: response.data.user_id,
        username: response.data.username,
        email: response.data.email,
        full_name: response.data.full_name,
        role: response.data.role,
        is_active: response.data.is_active,
        is_superuser: response.data.is_superuser,
      };


      return response.data;
    } catch (error) {
      console.error('AuthService: Login error:', error);
      throw new Error('Login failed. Please check your credentials.');
    }
  }

  /**
   * @description Logout current user
   * @returns Promise with logout response
   */
  async logout(): Promise<LogoutResponse> {
    try {
      const response = await apiPost<LogoutResponse>('/auth/logout');
      
      // Use TokenManager to securely clear all auth data
      tokenManager.clearTokens();
      this.currentUser = null;

      return response.data;
    } catch (error) {
      // Even if logout fails, clear local data
      tokenManager.clearTokens();
      this.currentUser = null;
      
      return { message: 'Logged out successfully' };
    }
  }

  /**
   * @description Refresh access token (delegated to TokenManager)
   * @param refreshToken - Refresh token
   * @returns Promise with new access token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const result = await tokenManager.refreshTokens();
    
    if (result.success && result.tokens) {
      return {
        access_token: result.tokens.access_token,
        token_type: 'bearer',
        expires_in: result.tokens.expires_in,
      };
    } else {
      throw new Error(result.error || 'Token refresh failed. Please login again.');
    }
  }

  /**
   * @description Get current user information
   * @returns Promise with current user data
   */
  async getCurrentUser(): Promise<CurrentUser> {
    try {
      const response = await apiGet<CurrentUser>('/auth/me');
      this.currentUser = response.data;
      return response.data;
    } catch (error) {
      throw new Error('Failed to get current user information.');
    }
  }

  /**
   * @description Check if user is authenticated (delegated to TokenManager)
   * @returns Boolean indicating authentication status
   */
  isAuthenticated(): boolean {
    return tokenManager.isAuthenticated();
  }

  /**
   * @description Get current user from cache
   * @returns Current user or null
   */
  getCurrentUserFromCache(): CurrentUser | null {
    return this.currentUser;
  }

  /**
   * @description Get stored access token (delegated to TokenManager)
   * @returns Access token or null
   */
  getAccessToken(): string | null {
    return tokenManager.getAccessToken();
  }

  /**
   * @description Get stored refresh token (delegated to TokenManager)
   * @returns Refresh token or null
   */
  getRefreshToken(): string | null {
    return tokenManager.getRefreshToken();
  }

  /**
   * @description Check if token is expired (delegated to TokenManager)
   * @returns Boolean indicating if token is expired
   */
  isTokenExpired(): boolean {
    const validation = tokenManager.validateAccessToken();
    return validation.isExpired;
  }

  /**
   * @description Initialize authentication state
   * @returns Promise with current user if authenticated
   */
  async initializeAuth(): Promise<CurrentUser | null> {
    if (this.isAuthenticated() && !this.isTokenExpired()) {
      try {
        return await this.getCurrentUser();
      } catch (error) {
        // If getting user info fails, clear auth state
        this.logout();
        return null;
      }
    }
    return null;
  }

  /**
   * @description Set access token from external source (delegated to TokenManager)
   * @param token - Access token to set
   */
  setAccessToken(token: string): void {
    // For compatibility, but prefer using TokenManager.setTokens()
    localStorage.setItem('access_token', token);
  }

  /**
   * @description Clear authentication state (delegated to TokenManager)
   */
  clearAuth(): void {
    tokenManager.clearTokens();
    this.currentUser = null;
  }
}

/**
 * @description Export singleton instance
 */
export const authService = AuthService.getInstance();
