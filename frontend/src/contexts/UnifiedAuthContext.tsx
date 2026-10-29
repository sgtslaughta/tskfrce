/**
 * @fileoverview Unified Authentication Context for TaaskMaaster
 * @description Centralized authentication state with synchronized token management
 * @author TaaskMaaster Team  
 * @version 2.0.0
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { tokenManager } from '../services/tokenManager';
import { authService } from '../services/authService';
import { 
  saveLoginState, 
  getLoginState, 
  clearLoginState,
  saveUserSettings,
  getUserSettings 
} from '../utils/cookies';

/**
 * @description User interface
 */
interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role: 'parent' | 'kid';
  points?: number;
  level?: number;
}

/**
 * @description v2 role from /auth/me or login. Legacy admin/organizer → parent, user → kid.
 */
export const toRole = (role?: string | null, isSuperuser?: boolean): 'parent' | 'kid' => {
  if (role === 'parent' || role === 'admin' || role === 'organizer') return 'parent';
  if (role === 'kid' || role === 'user') return 'kid';
  return isSuperuser ? 'parent' : 'kid';
};

/**
 * @description Authentication state
 */
interface AuthState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  hasValidToken: boolean;
}

/**
 * @description Unified auth context interface
 */
interface UnifiedAuthContextType extends AuthState {
  /** Login function */
  login: (credentials: { username: string; password: string; remember?: boolean }) => Promise<void>;
  /** Log in with an access token already issued by the backend (first-run setup) */
  loginWithToken: (accessToken: string, refreshToken: string, expiresIn: number) => Promise<void>;
  /** Logout function */
  logout: () => Promise<void>;
  /** Refresh authentication state */
  refreshAuth: () => Promise<void>;
  /** Clear error function */
  clearError: () => void;
  /** Check if user has valid authentication */
  isAuthReady: () => boolean;
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType | undefined>(undefined);

/**
 * @description Hook to use unified auth context
 */
export const useUnifiedAuth = (): UnifiedAuthContextType => {
  const context = useContext(UnifiedAuthContext);
  if (context === undefined) {
    throw new Error('useUnifiedAuth must be used within a UnifiedAuthProvider');
  }
  return context;
};

/**
 * @description Unified Authentication Provider Component
 */
export const UnifiedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    isInitialized: false,
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null,
    hasValidToken: false,
  });

  const initializationRef = useRef(false);

  /**
   * @description Update authentication state atomically
   */
  const updateAuthState = useCallback((updates: Partial<AuthState>) => {
    setState(prevState => ({ ...prevState, ...updates }));
  }, []);

  /**
   * @description Synchronize all authentication systems
   */
  const syncAuthSystems = useCallback(async (user?: User) => {
    try {
      if (user) {
        // AuthService and TokenManager are already set by AuthService.login()
        // Just sync cookies and state
        const accessToken = tokenManager.getAccessToken();
        
        if (accessToken) {
          // Save to cookies
          saveLoginState({
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            lastLogin: Date.now(),
          });
          
          updateAuthState({
            isAuthenticated: true,
            user,
            hasValidToken: true,
            error: null,
          });
        } else {
          throw new Error('No access token available after login');
        }
      } else {
        // Clear all systems
        tokenManager.clearTokens();
        clearLoginState();
        
        updateAuthState({
          isAuthenticated: false,
          user: null,
          hasValidToken: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Error synchronizing auth systems:', error);
      updateAuthState({ error: 'Failed to synchronize authentication' });
    }
  }, [updateAuthState]);

  /**
   * @description Initialize authentication from stored state
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initializeAuth = useCallback(async () => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    try {
      updateAuthState({ isLoading: true, error: null });

      // Initialize TokenManager
      tokenManager.initialize();

      // Check for existing authentication
      const cookieState = getLoginState();
      const accessToken = tokenManager.getAccessToken();

      if (cookieState && accessToken) {
        // Validate token
        const tokenValidation = tokenManager.validateAccessToken();

        if (tokenValidation.isValid && !tokenValidation.isExpired) {
          // Token is valid, set up auth state
          authService.setAccessToken(accessToken);

          try {
            const currentUser = await authService.getCurrentUser();
            const user: User = {
              id: currentUser.user_id.toString(),
              username: currentUser.username,
              email: currentUser.email,
              role: toRole(currentUser.role, currentUser.is_superuser),
            };

            updateAuthState({
              isAuthenticated: true,
              user,
              hasValidToken: true,
              isLoading: false,
              isInitialized: true,
            });

          } catch (userError) {
            console.warn('Failed to fetch current user:', userError);
            // Token might be invalid, try refresh
            await attemptTokenRefresh();
          }
        } else if (tokenValidation.shouldRefresh) {
          // Token expired, try to refresh
          await attemptTokenRefresh();
        } else {
          // Token invalid, clear everything
          await syncAuthSystems();
          updateAuthState({ isLoading: false, isInitialized: true });
        }
      } else {
        // No saved auth state
        await syncAuthSystems();
        updateAuthState({ isLoading: false, isInitialized: true });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      await syncAuthSystems();
      updateAuthState({
        error: 'Authentication initialization failed',
        isLoading: false,
        isInitialized: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncAuthSystems, updateAuthState]);

  /**
   * @description Attempt to refresh tokens
   */
  const attemptTokenRefresh = useCallback(async () => {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const refreshResult = await tokenManager.refreshTokens();
      
      if (refreshResult.success && refreshResult.tokens) {
        // Get user info and sync systems
        authService.setAccessToken(refreshResult.tokens.access_token);
        const currentUser = await authService.getCurrentUser();
        
        const user: User = {
          id: currentUser.user_id.toString(),
          username: currentUser.username,
          email: currentUser.email,
          role: toRole(currentUser.role, currentUser.is_superuser),
        };
        
        await syncAuthSystems(user);
        updateAuthState({
          isLoading: false,
          isInitialized: true,
        });
      } else if (refreshResult.shouldLogout === false) {
        // box unreachable: keep the tokens; the route guard shows "Can't reach your home box"
        updateAuthState({ isLoading: false, isInitialized: true });
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      await syncAuthSystems();
      updateAuthState({ 
        error: 'Session expired. Please log in again.',
        isLoading: false,
        isInitialized: true,
      });
    }
  }, [syncAuthSystems, updateAuthState]);

  /**
   * @description Login function
   */
  const login = useCallback(async (credentials: { username: string; password: string; remember?: boolean }) => {
    try {
      updateAuthState({ isLoading: true, error: null });

      const loginResponse = await authService.login({
        username: credentials.username,
        password: credentials.password,
        remember: credentials.remember ?? false, // "Keep me logged in": longer refresh token (§9)
      });
      
      const user: User = {
        id: loginResponse.user_id.toString(),
        username: loginResponse.username,
        email: loginResponse.email || credentials.username, // Fallback to username if no email
        role: toRole(loginResponse.role, loginResponse.is_superuser),
      };

      await syncAuthSystems(user);

      updateAuthState({ isLoading: false });
      
    } catch (error: any) {
      updateAuthState({
        error: error.message || 'Login failed. Please check your credentials.',
        isLoading: false,
      });
      throw error;
    }
  }, [syncAuthSystems, updateAuthState]);

  /**
   * @description Log in with tokens already issued by the backend (first-run setup)
   */
  const loginWithToken = useCallback(async (accessToken: string, refreshToken: string, expiresIn: number) => {
    tokenManager.setTokens({ access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn });
    const me = await authService.getCurrentUser();
    await syncAuthSystems({
      id: me.user_id.toString(),
      username: me.username,
      email: me.email,
      role: toRole(me.role, me.is_superuser),
    });
  }, [syncAuthSystems]);

  /**
   * @description Logout function
   */
  const logout = useCallback(async () => {
    try {
      updateAuthState({ isLoading: true });

      // Try to logout from server (best effort)
      try {
        await authService.logout();
      } catch (logoutError) {
        console.warn('Server logout failed:', logoutError);
      }

      // Clear all auth systems
      await syncAuthSystems();
      updateAuthState({ isLoading: false });

    } catch (error) {
      console.error('Logout error:', error);
      // Force clear even if there's an error
      await syncAuthSystems();
      updateAuthState({ 
        error: 'Logout encountered an error but was completed',
        isLoading: false,
      });
    }
  }, [syncAuthSystems, updateAuthState]);

  /**
   * @description Refresh authentication state
   */
  const refreshAuth = useCallback(async () => {
    const cookieState = getLoginState();
    if (cookieState) {
      await attemptTokenRefresh();
    }
  }, [attemptTokenRefresh]);

  /**
   * @description Clear error
   */
  const clearError = useCallback(() => {
    updateAuthState({ error: null });
  }, [updateAuthState]);

  /**
   * @description Check if authentication is ready for API calls
   */
  const isAuthReady = useCallback((): boolean => {
    if (!state.isInitialized || state.isLoading || !state.isAuthenticated || !state.hasValidToken) {
      return false;
    }
    
    // Direct validation - check if we have valid tokens (more lenient approach)
    const accessToken = tokenManager.getAccessToken();
    const authServiceToken = authService.getAccessToken();
    
    // More lenient check: just ensure we have tokens and they're not obviously broken
    const hasValidTokens = !!(accessToken && authServiceToken);
    
    if (!hasValidTokens) {
      console.log('🔍 AuthReady: Missing tokens:', {
        tokenDetails: {
          accessToken: !!accessToken,
          authServiceToken: !!authServiceToken
        }
      });
      return false;
    }
    
    // For now, be more lenient about perfect synchronization
    // The HTTP interceptor will handle token refresh if needed
    return true;
  }, [state]);

  // Initialize auth on mount
  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Set up token refresh listener
  useEffect(() => {
    const handleTokenRefresh = async () => {
      if (state.isAuthenticated) {
        const cookieState = getLoginState();
        if (cookieState) {
          try {
            const refreshResult = await tokenManager.refreshTokens();
            if (!refreshResult.success && refreshResult.shouldLogout !== false) {
              // Clear auth state on refresh failure
              tokenManager.clearTokens();
              clearLoginState();
              updateAuthState({
                isAuthenticated: false,
                user: null,
                hasValidToken: false,
                error: 'Session expired. Please log in again.',
              });
            }
          } catch (error) {
            console.error('Token refresh failed:', error);
          }
        }
      }
    };

    const handleTokenInvalid = async () => {
      tokenManager.clearTokens();
      clearLoginState();
      updateAuthState({
        isAuthenticated: false,
        user: null,
        hasValidToken: false,
        error: 'Session invalid. Please log in again.',
      });
    };

    tokenManager.addEventListener('expired', handleTokenRefresh);
    tokenManager.addEventListener('invalid', handleTokenInvalid);

    return () => {
      tokenManager.removeEventListener('expired', handleTokenRefresh);
      tokenManager.removeEventListener('invalid', handleTokenInvalid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isAuthenticated]);

  const contextValue: UnifiedAuthContextType = {
    ...state,
    login,
    loginWithToken,
    logout,
    refreshAuth,
    clearError,
    isAuthReady,
  };

  return (
    <UnifiedAuthContext.Provider value={contextValue}>
      {children}
    </UnifiedAuthContext.Provider>
  );
};