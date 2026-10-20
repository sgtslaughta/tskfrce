/**
 * @fileoverview Login Page Component
 * @description Authentication page with image background following Mantine's design patterns
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState } from 'react';
import {
  Anchor,
  Button,
  Checkbox,
  Paper,
  PasswordInput,
  Text,
  TextInput,
  Title,
  Stack,
  Alert,
  Group,
  ThemeIcon,
  Center,
  BackgroundImage,
  Image
} from '@mantine/core';
import {
  IconChecklist,
  IconAlertCircle
} from '@tabler/icons-react';
import DarkVeil from '../ui/DarkVeil';
import { useTheme } from '@/contexts';
import classes from './LoginPage.module.css';

interface LoginPageProps {
  /** Function called when login is successful */
  onLogin?: (credentials: { identifier: string; password: string; rememberMe: boolean }) => void;
  /** Function called when register link is clicked */
  onRegister?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Error message to display */
  error?: string;
}

export function LoginPage({ onLogin, onRegister, loading = false, error }: LoginPageProps) {
  const { isDarkMode } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{identifier?: string; password?: string}>({});

  const validateForm = () => {
    const errors: {identifier?: string; password?: string} = {};
    
    if (!identifier.trim()) {
      errors.identifier = 'Username or email is required';
    } else if (identifier.trim().length < 3) {
      errors.identifier = 'Username must be at least 3 characters or a valid email';
    }
    
    if (!password.trim()) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm() && onLogin) {
      onLogin({ identifier: identifier.trim(), password, rememberMe });
    }
  };

  return (
    <div className={classes.wrapper}>
      {/* Animated Dark Veil Background */}
      <DarkVeil 
        hueShift={21}
        noiseIntensity={0}
        scanlineIntensity={0.1}
        speed={3}
        scanlineFrequency={5}
        warpAmount={5}
        resolutionScale={0.8}
      />
      
      <Center style={{ height: '100vh', position: 'relative', zIndex: 2 }}>
        <Paper 
          className={classes.form} 
          radius="md" 
          p="xl" 
          withBorder 
          bg={isDarkMode ? 'dark.7' : 'white'}
          opacity={0.9}
        >
          <Group justify="center" mb="xl">
            <Image
              src={isDarkMode ? '/logo_large_full_light.png' : '/logo_large_full_dark.png'}
              alt="TaaskMaaster Logo"
              height={160}
              width="auto"
              fit="contain"
            />
          </Group>

          {error && (
            <Alert 
              icon={<IconAlertCircle size={16} />} 
              color="red" 
              mb="md"
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} autoComplete="on">
            <TextInput
              label="Username or Email"
              placeholder="username or your@email.com"
              size="md"
              value={identifier}
              onChange={(e) => setIdentifier(e.currentTarget.value)}
              error={validationErrors.identifier}
              disabled={loading}
              required
              autoComplete="username"
              name="username"
              id="username"
              data-1p-ignore
            />
            
            <PasswordInput
              label="Password"
              placeholder="Your password"
              mt="md"
              size="md"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              error={validationErrors.password}
              disabled={loading}
              required
              autoComplete="current-password"
              name="password"
              id="password"
              data-1p-ignore
            />
            
            <Checkbox
              label="Keep me logged in"
              mt="xl"
              size="md"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.currentTarget.checked)}
              disabled={loading}
            />
            
            <Button
              type="submit"
              fullWidth
              mt="xl"
              size="md"
              loading={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <Text ta="center" mt="md" size="sm">
            Don&apos;t have an account?{' '}
            <Anchor
              href="#"
              fw={700}
              onClick={(event) => {
                event.preventDefault();
                onRegister?.();
              }}
            >
              Register
            </Anchor>
          </Text>

          <Text ta="center" mt="xs" size="xs" c="dimmed">
            Forgot your password?{' '}
            <Anchor
              href="#"
              size="xs"
              onClick={(event) => {
                event.preventDefault();
                // Handle forgot password
                console.log('Forgot password clicked');
              }}
            >
              Reset it here
            </Anchor>
          </Text>
        </Paper>
      </Center>
    </div>
  );
}