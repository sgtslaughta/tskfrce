/**
 * @fileoverview Auth Guard Component
 * @description Protects routes and shows login page when not authenticated
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React from 'react';
import { LoadingOverlay, Box } from '@mantine/core';
import { useUnifiedAuth } from '../../contexts/UnifiedAuthContext';
import { LoginPage } from './LoginPage';
import { useRouter } from 'next/router';
import { notifications } from '@mantine/notifications';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, login, error, clearError } = useUnifiedAuth();
  const router = useRouter();

  // Clear errors when component mounts
  React.useEffect(() => {
    clearError();
  }, [clearError]);

  const handleLogin = async (credentials: { identifier: string; password: string; rememberMe: boolean }) => {
    try {
      // Pass identifier directly - backend will handle username or email
      await login({ 
        username: credentials.identifier, 
        password: credentials.password 
      });
      
      notifications.show({
        title: 'Welcome back!',
        message: 'You have been successfully signed in.',
        color: 'green'
      });
    } catch (err) {
      // Error is handled by AuthContext and displayed via error prop
      console.error('Login failed:', err);
    }
  };

  const handleRegister = () => {
    router.push('/register');
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box style={{ position: 'relative', minHeight: '100vh' }}>
        <LoadingOverlay 
          visible={true} 
          overlayProps={{ radius: 'sm', blur: 2 }}
          loaderProps={{ size: 'lg' }}
        />
      </Box>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={isLoading}
        error={error ?? undefined}
      />
    );
  }

  // Show protected content if authenticated
  return <>{children}</>;
}