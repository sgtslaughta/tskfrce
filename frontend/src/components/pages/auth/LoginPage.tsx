/**
 * @fileoverview Login page component for TaaskMaaster
 * @description A modern login page with animations, form validation, and social login integration
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { useUnifiedAuth } from '../../../contexts/UnifiedAuthContext';
import { cn } from '../../../design-system/utils/cn';

/**
 * @description Login page props interface
 */
export interface LoginPageProps {
  /** Function called when login is successful */
  onSubmit?: (data: LoginFormData) => void;
  /** Function called when register link is clicked */
  onRegisterClick?: () => void;
  /** Function called when forgot password link is clicked */
  onForgotPasswordClick?: () => void;
  /** Function called when social login is attempted */
  onSocialLogin?: (provider: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * @description Login form data interface
 */
export interface LoginFormData {
  /** User's email or username */
  email: string;
  /** User's password */
  password: string;
}

/**
 * @description Login page component
 * 
 * A modern login page with:
 * - Floating card design
 * - Form validation
 * - Social login options
 * - Dark mode support
 * - Responsive design
 * - Accessibility features
 */
export const LoginPage: React.FC<LoginPageProps> = ({
  onSubmit,
  onRegisterClick,
  onForgotPasswordClick,
  onSocialLogin,
  className,
}) => {
  const { login, error, clearError } = useUnifiedAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: 'admin',
    password: 'admin123',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * @description Validate form data
   */
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Username or email is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * @description Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      try {
        clearError();
        await login({
          username: formData.email,
          password: formData.password,
        });

        // Call external onSubmit if provided
        if (onSubmit) {
          onSubmit(formData);
        }
      } catch (error) {
        // Error is handled by the auth context
        console.error('Login failed:', error);
      }
    }
  };

  /**
   * @description Handle input changes
   */
  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData((prev: LoginFormData) => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className={cn(
      'min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100',
      'dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8',
      className
    )}>
      <div className="max-w-md w-full">
        {/* Logo and welcome */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
            <Image 
              src="/favicon-32x32.png" 
              alt="TaaskMaaster Logo" 
              width={32}
              height={32}
              className="w-8 h-8"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Sign in to your TaaskMaaster account
          </p>
        </div>

        {/* Login card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email/Username Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username or Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={cn(
                    'block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm',
                    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400',
                    'dark:focus:ring-blue-400 dark:focus:border-blue-400',
                    errors.email && 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  )}
                  placeholder="Enter your username or email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={cn(
                    'block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm',
                    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    'dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400',
                    'dark:focus:ring-blue-400 dark:focus:border-blue-400',
                    errors.password && 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  )}
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {/* Remember Me and Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className={cn(
                      'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded',
                      'dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-400'
                    )}
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <button
                    type="button"
                    onClick={onForgotPasswordClick}
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <div>
                <button
                  type="submit"
                  className={cn(
                    'w-full flex justify-center py-3 px-4 border border-transparent rounded-lg',
                    'text-sm font-medium text-white bg-blue-600 hover:bg-blue-700',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                    'dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-400',
                    'transition-colors duration-200 shadow-sm'
                  )}
                >
                  Sign in
                </button>
              </div>

              {/* Social Login */}
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onSocialLogin?.('google')}
                    className={cn(
                      'w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg',
                      'shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50',
                      'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                      'transition-colors duration-200'
                    )}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="ml-2">Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSocialLogin?.('github')}
                    className={cn(
                      'w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-lg',
                      'shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50',
                      'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                      'transition-colors duration-200'
                    )}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="ml-2">GitHub</span>
                  </button>
                </div>
              </div>

              {/* Register Link */}
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={onRegisterClick}
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>


      </div>
    </div>
  );
};
