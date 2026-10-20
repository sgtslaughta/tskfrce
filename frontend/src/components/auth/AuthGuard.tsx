/**
 * @fileoverview Auth Guard Component
 * @description Protects legacy routes: logged-out visitors go to /login and come back after
 */

import React, { useEffect } from 'react';
import { LoadingOverlay, Box } from '@mantine/core';
import { useRouter } from 'next/router';
import { useUnifiedAuth } from '../../contexts/UnifiedAuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useUnifiedAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <Box style={{ position: 'relative', minHeight: '100vh' }}>
        <LoadingOverlay visible overlayProps={{ radius: 'sm', blur: 2 }} loaderProps={{ size: 'lg' }} />
      </Box>
    );
  }

  return <>{children}</>;
}
