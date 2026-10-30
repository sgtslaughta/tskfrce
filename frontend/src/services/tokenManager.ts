/**
 * @fileoverview Token Manager
 * @description Centralized, secure token management with automatic refresh, validation, and cleanup
 * @version 1.0.0
 */

import { markSessionExpired, takeSessionExpired } from '@/v2/login/sessionExpired';
import {
  createSafeStorage,
  storeTokens,
  clearAllTokens,
  dropIfSessionEnded,
  SafeStorage
} from './tokenStorage';
import {
  validateAccessToken,
  canRefreshToken,
  isAuthenticated as checkAuthenticated
} from './tokenValidator';
import { isRefreshTokenExpired } from './tokenConversion';
import {
  getAccessToken,
  getRefreshToken,
  getStoredRefreshExpiry
} from './tokenStorage';

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
  private safeLocalStorage: SafeStorage;

  private constructor() {
    this.safeLocalStorage = createSafeStorage();
    dropIfSessionEnded(this.safeLocalStorage);
  }

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
    storeTokens(this.safeLocalStorage, tokens, userInfo);
    takeSessionExpired(); // a fresh session: drop any stale "logged out" note
    this.scheduleTokenRefresh();
    this.resetRefreshRetryCount();
  }

  /**
   * @description Get current access token
   */
  public getAccessToken(): string | null {
    return getAccessToken(this.safeLocalStorage);
  }

  /**
   * @description Get current refresh token
   */
  public getRefreshToken(): string | null {
    return getRefreshToken(this.safeLocalStorage);
  }

  /**
   * @description Validate current access token
   */
  public validateAccessToken(): TokenValidation {
    return validateAccessToken(this.safeLocalStorage);
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
    const refreshExpiry = getStoredRefreshExpiry(this.safeLocalStorage);
    if (isRefreshTokenExpired(refreshExpiry)) {
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
    clearAllTokens(this.safeLocalStorage);

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
  }

  /**
   * @description Check if user has valid authentication
   */
  public isAuthenticated(): boolean {
    return checkAuthenticated(this.safeLocalStorage);
  }

  /**
   * @description Check if refresh token is available and valid
   */
  public canRefreshToken(): boolean {
    return canRefreshToken(this.safeLocalStorage);
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
   * @description Perform actual token refresh API call
   */
  private async performTokenRefresh(refreshToken: string): Promise<TokenRefreshResult> {
    try {
      this.refreshRetryCount++;
      
      // the box being down (network error, or 5xx from the proxy) is not a bad session:
      // keep the tokens so the parent is still signed in once it answers again
      const unreachable: TokenRefreshResult = { success: false, error: 'Home box unreachable', shouldLogout: false };
      let response: Response;
      try {
        response = await fetch('/api/proxy/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch {
        this.refreshRetryCount = 0;
        return unreachable;
      }
      if (response.status >= 500) {
        this.refreshRetryCount = 0;
        return unreachable;
      }

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
      
      // Check if we should retry
      if (this.refreshRetryCount < this.MAX_REFRESH_RETRIES) {

        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, this.refreshRetryCount - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.performTokenRefresh(refreshToken);
      }

      console.warn('Token refresh failed:', error instanceof Error ? error.message : error); // once, after the retries
      this.emitEvent('invalid');
      markSessionExpired();
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
      if (this.getAccessToken()) markSessionExpired(); // a cold visit with no session is not an expiry

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
