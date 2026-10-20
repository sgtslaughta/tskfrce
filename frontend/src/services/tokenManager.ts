/**
 * @fileoverview Token Manager for TaaskMaaster
 * @description Centralized, secure token management with automatic refresh, validation, and cleanup
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { saveLoginState, clearLoginState, getLoginState } from '../utils/cookies';

/**
 * @description Token pair interface
 */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
}

/**
 * @description Token validation result
 */
export interface TokenValidation {
  isValid: boolean;
  isExpired: boolean;
  expiresAt?: Date;
  timeUntilExpiry?: number;
  shouldRefresh: boolean;
}

/**
 * @description Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  tokens?: TokenPair;
  error?: string;
  shouldLogout: boolean;
}

/**
 * @description Token manager events
 */
export type TokenEvent = 'refreshed' | 'expired' | 'invalid' | 'revoked';

/**
 * @description Token event listener
 */
export type TokenEventListener = (event: TokenEvent, data?: any) => void;

/**
 * @description Centralized token manager
 */
export class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<TokenRefreshResult> | null = null;
  private refreshTimeout: NodeJS.Timeout | null = null;
  private eventListeners: Map<TokenEvent, TokenEventListener[]> = new Map();
  private isRefreshing = false;
  private readonly REFRESH_BUFFER_TIME = 5 * 60 * 1000; // 5 minutes before expiry
  private readonly MAX_REFRESH_RETRIES = 3;
  private refreshRetryCount = 0;

  /**
   * @description Safe localStorage access that handles SSR
   */
  private safeLocalStorage = {
    getItem: (key: string): string | null => {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(key);
    },
    setItem: (key: string, value: string): void => {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, value);
    },
    removeItem: (key: string): void => {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(key);
    }
  };

  /**
   * @description Get singleton instance
   */
  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * @description Initialize token manager
   */
  public initialize(): void {
    this.scheduleTokenRefresh();
    this.setupVisibilityListener();
    this.validateStoredTokens();
  }

  /**
   * @description Set tokens securely
   * @param tokens - Token pair to store
   * @param userInfo - User information for login state
   */
  public setTokens(tokens: TokenPair, userInfo?: any): void {
    try {
      // Store tokens in localStorage (consider moving to secure httpOnly cookies in production)
      this.safeLocalStorage.setItem('access_token', tokens.access_token);
      this.safeLocalStorage.setItem('refresh_token', tokens.refresh_token);
      
      // Store expiration times
      const accessExpiry = this.calculateTokenExpiry(tokens.access_token);
      const refreshExpiry = tokens.refresh_expires_in 
        ? Date.now() + (tokens.refresh_expires_in * 1000)
        : null;
      
      this.safeLocalStorage.setItem('access_token_expiry', accessExpiry.getTime().toString());
      if (refreshExpiry) {
        this.safeLocalStorage.setItem('refresh_token_expiry', refreshExpiry.toString());
      }

      // Update login state if user info provided
      if (userInfo) {
        const loginState = getLoginState();
        saveLoginState({
          ...loginState,
          ...userInfo,
          token: tokens.access_token,
          lastLogin: Date.now(),
        });
      }

      // Schedule next refresh
      this.scheduleTokenRefresh();
      this.resetRefreshRetryCount();


    } catch (error) {
      console.error('❌ Failed to store tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * @description Get current access token
   */
  public getAccessToken(): string | null {
    return this.safeLocalStorage.getItem('access_token');
  }

  /**
   * @description Get current refresh token
   */
  public getRefreshToken(): string | null {
    return this.safeLocalStorage.getItem('refresh_token');
  }

  /**
   * @description Validate current access token
   */
  public validateAccessToken(): TokenValidation {
    const token = this.getAccessToken();
    
    if (!token) {
      return {
        isValid: false,
        isExpired: true,
        shouldRefresh: false
      };
    }

    try {
      const expiry = this.getTokenExpiry(token);
      const now = new Date();
      const timeUntilExpiry = expiry.getTime() - now.getTime();
      const isExpired = timeUntilExpiry <= 0;
      const shouldRefresh = timeUntilExpiry <= this.REFRESH_BUFFER_TIME;

      return {
        isValid: !isExpired,
        isExpired,
        expiresAt: expiry,
        timeUntilExpiry: Math.max(0, timeUntilExpiry),
        shouldRefresh: shouldRefresh && !isExpired
      };
    } catch (error) {
      console.error('❌ Token validation failed:', error);
      return {
        isValid: false,
        isExpired: true,
        shouldRefresh: false
      };
    }
  }

  /**
   * @description Refresh tokens automatically
   */
  public async refreshTokens(): Promise<TokenRefreshResult> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.isRefreshing = false;
      return {
        success: false,
        error: 'No refresh token available',
        shouldLogout: true
      };
    }

    // Check if refresh token is expired
    if (this.isRefreshTokenExpired()) {
      this.isRefreshing = false;
      this.emitEvent('expired');
      return {
        success: false,
        error: 'Refresh token expired',
        shouldLogout: true
      };
    }

    this.refreshPromise = this.performTokenRefresh(refreshToken);
    const result = await this.refreshPromise;
    
    this.isRefreshing = false;
    this.refreshPromise = null;

    return result;
  }

  /**
   * @description Clear all tokens and auth state
   */
  public clearTokens(): void {
    try {
      // Clear localStorage
      this.safeLocalStorage.removeItem('access_token');
      this.safeLocalStorage.removeItem('refresh_token');
      this.safeLocalStorage.removeItem('access_token_expiry');
      this.safeLocalStorage.removeItem('refresh_token_expiry');
      
      // Clear login state cookies
      clearLoginState();
      
      // Cancel any scheduled refresh
      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = null;
      }

      // Reset state
      this.isRefreshing = false;
      this.refreshPromise = null;
      this.resetRefreshRetryCount();


      this.emitEvent('revoked');
    } catch (error) {
      console.error('❌ Failed to clear tokens:', error);
    }
  }

  /**
   * @description Check if user has valid authentication
   */
  public isAuthenticated(): boolean {
    const validation = this.validateAccessToken();
    return validation.isValid || this.canRefreshToken();
  }

  /**
   * @description Check if refresh token is available and valid
   */
  public canRefreshToken(): boolean {
    const refreshToken = this.getRefreshToken();
    return !!refreshToken && !this.isRefreshTokenExpired();
  }

  /**
   * @description Add event listener
   */
  public addEventListener(event: TokenEvent, listener: TokenEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * @description Remove event listener
   */
  public removeEventListener(event: TokenEvent, listener: TokenEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * @description Force token validation and refresh if needed
   */
  public async ensureValidToken(): Promise<boolean> {
    const validation = this.validateAccessToken();
    
    if (validation.isValid && !validation.shouldRefresh) {
      return true;
    }

    if (validation.isExpired || validation.shouldRefresh) {
      if (this.canRefreshToken()) {
        const refreshResult = await this.refreshTokens();
        return refreshResult.success;
      }
    }

    return false;
  }

  // Private methods

  /**
   * @description Calculate token expiry from JWT
   */
  private calculateTokenExpiry(token: string): Date {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return new Date(payload.exp * 1000);
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  /**
   * @description Get token expiry from JWT or stored value
   */
  private getTokenExpiry(token: string): Date {
    try {
      // Try to get from stored expiry first (more reliable)
      const storedExpiry = this.safeLocalStorage.getItem('access_token_expiry');
      if (storedExpiry) {
        return new Date(parseInt(storedExpiry));
      }
      
      // Fallback to JWT parsing
      return this.calculateTokenExpiry(token);
    } catch (error) {
      throw new Error('Cannot determine token expiry');
    }
  }

  /**
   * @description Check if refresh token is expired
   */
  private isRefreshTokenExpired(): boolean {
    const refreshExpiry = this.safeLocalStorage.getItem('refresh_token_expiry');
    if (!refreshExpiry) {
      // If no expiry stored, assume it's still valid (depends on your backend)
      return false;
    }
    
    return Date.now() >= parseInt(refreshExpiry);
  }

  /**
   * @description Perform actual token refresh API call
   */
  private async performTokenRefresh(refreshToken: string): Promise<TokenRefreshResult> {
    try {
      this.refreshRetryCount++;
      
      const response = await fetch('/api/proxy/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update tokens
      const newTokens: TokenPair = {
        access_token: data.access_token,
        refresh_token: refreshToken, // Keep existing refresh token unless new one provided
        expires_in: data.expires_in || 3600, // Default 1 hour
      };

      this.setTokens(newTokens);
      this.emitEvent('refreshed', newTokens);
      

      return {
        success: true,
        tokens: newTokens,
        shouldLogout: false
      };

    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      
      // Check if we should retry
      if (this.refreshRetryCount < this.MAX_REFRESH_RETRIES) {

        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, this.refreshRetryCount - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.performTokenRefresh(refreshToken);
      }

      this.emitEvent('invalid');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldLogout: true
      };
    }
  }

  /**
   * @description Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    const validation = this.validateAccessToken();
    if (!validation.isValid || !validation.timeUntilExpiry) {
      return;
    }

    // Schedule refresh 5 minutes before expiry
    const refreshIn = Math.max(1000, validation.timeUntilExpiry - this.REFRESH_BUFFER_TIME);
    
    this.refreshTimeout = setTimeout(async () => {

      await this.refreshTokens();
    }, refreshIn);


  }

  /**
   * @description Setup page visibility listener for token validation
   */
  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Page became visible, validate tokens
          this.validateStoredTokens();
        }
      });
    }
  }

  /**
   * @description Validate stored tokens on init/visibility change
   */
  private validateStoredTokens(): void {
    const validation = this.validateAccessToken();
    
    if (validation.isExpired && this.canRefreshToken()) {

      this.refreshTokens();
    } else if (validation.isExpired && !this.canRefreshToken()) {

      this.clearTokens();
    }
  }

  /**
   * @description Emit token event to listeners
   */
  private emitEvent(event: TokenEvent, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event, data);
        } catch (error) {
          console.error('❌ Token event listener error:', error);
        }
      });
    }
  }

  /**
   * @description Reset refresh retry counter
   */
  private resetRefreshRetryCount(): void {
    this.refreshRetryCount = 0;
  }
}

/**
 * @description Export singleton instance
 */
export const tokenManager = TokenManager.getInstance();
