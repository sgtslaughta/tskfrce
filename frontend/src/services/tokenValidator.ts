/**
 * @fileoverview Token validation utilities
 * Validates token status and determines refresh necessity
 */

import { TokenValidation } from './tokenManager';
import { SafeStorage } from './tokenStorage';
import { getTokenExpiry, isRefreshTokenExpired } from './tokenConversion';
import {
  getAccessToken,
  getRefreshToken,
  getStoredTokenExpiry,
  getStoredRefreshExpiry
} from './tokenStorage';

const REFRESH_BUFFER_TIME = 5 * 60 * 1000; // 5 minutes before expiry

/**
 * Validate current access token
 */
export function validateAccessToken(
  storage: SafeStorage
): TokenValidation {
  const token = getAccessToken(storage);

  if (!token) {
    return {
      isValid: false,
      isExpired: true,
      shouldRefresh: false
    };
  }

  try {
    const storedExpiry = getStoredTokenExpiry(storage);
    const expiry = getTokenExpiry(token, storedExpiry);
    const now = new Date();
    const timeUntilExpiry = expiry.getTime() - now.getTime();
    const isExpired = timeUntilExpiry <= 0;
    const shouldRefresh = timeUntilExpiry <= REFRESH_BUFFER_TIME;

    return {
      isValid: !isExpired,
      isExpired,
      expiresAt: expiry,
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
      shouldRefresh: shouldRefresh && !isExpired
    };
  } catch (error) {
    console.error('Token validation failed:', error);
    return {
      isValid: false,
      isExpired: true,
      shouldRefresh: false
    };
  }
}

/**
 * Check if refresh token is available and valid
 */
export function canRefreshToken(storage: SafeStorage): boolean {
  const refreshToken = getRefreshToken(storage);
  const refreshExpiry = getStoredRefreshExpiry(storage);
  return !!refreshToken && !isRefreshTokenExpired(refreshExpiry);
}

/**
 * Check if user has valid authentication
 */
export function isAuthenticated(storage: SafeStorage): boolean {
  const validation = validateAccessToken(storage);
  return validation.isValid || canRefreshToken(storage);
}
