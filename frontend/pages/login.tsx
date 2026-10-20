/**
 * @fileoverview Login Page
 * @description Authentication page for TaaskMaaster
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { LoginPage } from '../src/components/auth';
import { useUnifiedAuth } from '../src/contexts/UnifiedAuthContext';
import { notifications } from '@mantine/notifications';

export default function Login() {
  const router = useRouter();
  const { login, isLoading, error, isAuthenticated, clearError } = useUnifiedAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  // Clear errors when component mounts
  useEffect(() => {
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
      
      // Router redirect is handled by the useEffect above
    } catch (err) {
      // Error is handled by AuthContext and displayed via error prop
      console.error('Login failed:', err);
    }
  };

  const handleRegister = () => {
    notifications.show({
      title: 'Registration',
      message: 'Registration feature coming soon!',
      color: 'blue'
    });
  };

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Sign In - TaaskMaaster</title>
        <meta name="description" content="Sign in to your TaaskMaaster account" />
      </Head>
      
      <LoginPage
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={isLoading}
        error={error ?? undefined}
      />
    </>
  );
}