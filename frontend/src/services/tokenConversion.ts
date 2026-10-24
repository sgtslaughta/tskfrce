/**
 * @fileoverview Token conversion and JWT parsing utilities
 * Handles JWT token parsing and expiry calculation
 */

/**
 * Calculate token expiry from JWT
 */
export function calculateTokenExpiry(token: string): Date {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return new Date(payload.exp * 1000);
  } catch (error) {
    throw new Error('Invalid token format');
  }
}

/**
 * Get token expiry from JWT or stored value
 */
export function getTokenExpiry(
  token: string,
  storedExpiry: string | null
): Date {
  try {
    // Try to get from stored expiry first (more reliable)
    if (storedExpiry) {
      return new Date(parseInt(storedExpiry));
    }

    // Fallback to JWT parsing
    return calculateTokenExpiry(token);
  } catch (error) {
    throw new Error('Cannot determine token expiry');
  }
}

/**
 * Check if refresh token is expired
 */
export function isRefreshTokenExpired(refreshExpiry: string | null): boolean {
  if (!refreshExpiry) {
    // If no expiry stored, assume it's still valid
    return false;
  }

  return Date.now() >= parseInt(refreshExpiry);
}
