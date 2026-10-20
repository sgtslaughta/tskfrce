/**
 * @fileoverview Authentication Context for TaaskMaaster
 * @description React context for managing authentication state
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { tokenManager } from '../services/tokenManager';
import { 
  saveLoginState, 
  getLoginState, 
  clearLoginState,
  saveUserSettings,
  getUserSettings 
} from '../utils/cookies';
import { TaskWarningModal } from '../components/modals/TaskWarningModal';

/**
 * @description User interface
 */
interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role?: string;
  points?: number;
  level?: number;
}

/**
 * @description Auth context interface
 */
interface AuthContextType {
  /** Current user */
  user: User | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth is loading */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Login function */
  login: (credentials: { username: string; password: string }) => Promise<void>;
  /** Logout function */
  logout: () => Promise<void>;
  /** Clear error function */
  clearError: () => void;
}

/**
 * @description Auth context default values
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * @description Auth provider component
 * Manages authentication state and provides auth functions
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTaskWarningModal, setShowTaskWarningModal] = useState(false);

  /**
   * @description Initialize auth state from cookies
   */
  useEffect(() => {
    // Initialize TokenManager
    tokenManager.initialize();
    
    // Setup forced logout listener
    const handleForcedLogout = (event: any) => {

      setUser(null);
      setIsLoading(false);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('forceLogout', handleForcedLogout);
    }
    
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        
        // Check for saved login state in cookies
        const savedLoginState = getLoginState();
        
        if (savedLoginState && savedLoginState.token) {
          // Set the token in auth service
          authService.setAccessToken(savedLoginState.token);
          
          // Check if token is expired before making API calls
          if (authService.isTokenExpired()) {

            
            try {
              const refreshToken = authService.getRefreshToken();
              if (refreshToken) {
                const refreshResponse = await authService.refreshToken(refreshToken);

                
                // Update the saved login state with new token
                saveLoginState({
                  ...savedLoginState,
                  token: refreshResponse.access_token,
                  lastLogin: Date.now(),
                });
                
                // Now try to get current user with fresh token
                const currentUser = await authService.getCurrentUser();
                setUser({
                  id: currentUser.user_id.toString(),
                  username: currentUser.username,
                  email: currentUser.email,
                  role: currentUser.role || (currentUser.is_superuser ? 'admin' : 'user'),
                });
              } else {
                throw new Error('No refresh token available');
              }
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
              // Clear invalid login state and force re-login
              clearLoginState();
              authService.clearAuth();
              setUser(null);
            }
          } else {
            // Token is not expired, proceed normally
            try {
              const currentUser = await authService.getCurrentUser();
              setUser({
                id: currentUser.user_id.toString(),
                username: currentUser.username,
                email: currentUser.email,
                role: currentUser.role || (currentUser.is_superuser ? 'admin' : 'user'),
              });
              
              // Update last login time
              saveLoginState({
                ...savedLoginState,
                lastLogin: Date.now(),
              });
            } catch (error) {
              console.error('Failed to get current user from saved session:', error);
              // Clear invalid login state
              clearLoginState();
              authService.clearAuth();
              setUser(null);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('forceLogout', handleForcedLogout);
      }
    };
  }, []);

  /**
   * @description Login function
   */
  const login = async (credentials: { username: string; password: string }) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authService.login(credentials);
      
      // Convert API response to User interface
      const userData: User = {
        id: response.user_id.toString(),
        username: response.username,
        email: response.email,
        role: response.role || (response.is_superuser ? 'admin' : 'user'),
      };
      
      // Save login state to cookies
      saveLoginState({
        userId: userData.id,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        token: response.access_token,
        lastLogin: Date.now(),
      });

      // Update user settings with last login
      saveUserSettings({
        lastLogin: Date.now(),
      });

      setUser(userData);

      // Show task warning modal after successful login (if enabled)
      const settings = getUserSettings();
      if (settings.preferences?.showTaskWarnings !== false) {
        setShowTaskWarningModal(true);
      }

    } catch (error: any) {
      console.error('AuthContext: Login failed with error:', error);
      const errorMessage = error.message || 'Login failed';
      setError(errorMessage);
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @description Logout function
   */
  const logout = async () => {
    try {
      // Call logout API
      await authService.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with local logout even if API call fails
    } finally {
      // Clear local state
      setUser(null);
      setError(null);
      
      // Clear cookies
      clearLoginState();
      
      // Clear auth service token
      authService.clearAuth();
      

    }
  };

  /**
   * @description Clear error function
   */
  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      error,
      login,
      logout,
      clearError,
    }}>
      {children}
      
      {/* Task Warning Modal */}
      {user && (
        <TaskWarningModal
          opened={showTaskWarningModal}
          onClose={() => setShowTaskWarningModal(false)}
          userId={user.id}
        />
      )}
    </AuthContext.Provider>
  );
};

/**
 * @description Hook to use auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
