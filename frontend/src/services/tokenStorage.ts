/**
 * @fileoverview Token storage utilities
 * Safe localStorage access with SSR compatibility
 */

import { TokenPair } from './tokenManager';
import { saveLoginState, clearLoginState, getLoginState } from '../utils/cookies';
import { calculateTokenExpiry } from './tokenConversion';

/**
 * Safe localStorage interface
 */
export interface SafeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/**
 * Create safe localStorage handler for SSR
 */
export function createSafeStorage(): SafeStorage {
  return {
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
}

/**
 * Store tokens securely
 */
export function storeTokens(
  storage: SafeStorage,
  tokens: TokenPair,
  userInfo?: any
): void {
  try {
    // Store tokens in localStorage
    storage.setItem('access_token', tokens.access_token);
    storage.setItem('refresh_token', tokens.refresh_token);

    // Store expiration times
    const accessExpiry = calculateTokenExpiry(tokens.access_token);
    const refreshExpiry = tokens.refresh_expires_in
      ? Date.now() + tokens.refresh_expires_in * 1000
      : null;

    storage.setItem('access_token_expiry', accessExpiry.getTime().toString());
    if (refreshExpiry) {
      storage.setItem('refresh_token_expiry', refreshExpiry.toString());
    }

    // Update login state if user info provided
    if (userInfo) {
      const loginState = getLoginState();
      saveLoginState({
        ...loginState,
        ...userInfo,
        token: tokens.access_token,
        lastLogin: Date.now()
      });
    }
  } catch (error) {
    console.error('Failed to store tokens:', error);
    throw new Error('Failed to store authentication tokens');
  }
}

/**
 * Clear all tokens and auth state
 */
export function clearAllTokens(storage: SafeStorage): void {
  try {
    // Clear localStorage
    storage.removeItem('access_token');
    storage.removeItem('refresh_token');
    storage.removeItem('access_token_expiry');
    storage.removeItem('refresh_token_expiry');

    // Clear login state cookies
    clearLoginState();
  } catch (error) {
    console.error('Failed to clear tokens:', error);
  }
}

/**
 * Get access token
 */
export function getAccessToken(storage: SafeStorage): string | null {
  return storage.getItem('access_token');
}

/**
 * Get refresh token
 */
export function getRefreshToken(storage: SafeStorage): string | null {
  return storage.getItem('refresh_token');
}

/**
 * Get stored token expiry
 */
export function getStoredTokenExpiry(storage: SafeStorage): string | null {
  return storage.getItem('access_token_expiry');
}

/**
 * Get stored refresh token expiry
 */
export function getStoredRefreshExpiry(storage: SafeStorage): string | null {
  return storage.getItem('refresh_token_expiry');
}
