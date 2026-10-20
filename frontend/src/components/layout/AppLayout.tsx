/**
 * @fileoverview Main App Layout Component - Rebuilt with Mantine AppShell
 * @description Layout wrapper with navigation sidebar and header
 * @author TaaskMaaster Team
 * @version 2.0.0
 */

import React, { useState, useEffect } from 'react';
import { AppShell, Burger, Group, Text, Button, Image, useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSparkles } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { NavbarNested } from '@/components';
import { NavbarMinimal } from '@/components';
import { NotificationBell } from '../notifications/NotificationBell';
import { tokenManager } from '@/services/tokenManager';
import { useNotifications } from '@/contexts';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
  onNavigate?: (pageId: string) => void;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    points?: number;
    level?: number;
  } | null;
  onLogout?: () => void;
}

export function AppLayout({ 
  children, 
  currentPage, 
  onNavigate, 
  user, 
  onLogout
}: AppLayoutProps) {
  const { colorScheme } = useMantineColorScheme();
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(false); // Collapsed by default
  const [isHovered, setIsHovered] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  
  // Get notification functions
  const { refreshStoredNotifications, showTestMantineNotification } = useNotifications();

  const handleGenerateDemo = async () => {
    if (isGeneratingDemo) {
      console.log('Demo generation already in progress, skipping...');
      return;
    }

    setIsGeneratingDemo(true);
    try {
      const response = await fetch('/api/proxy/notifications/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'X-User-Data': JSON.stringify({
            user_id: user?.id || '1',
            username: user?.username || 'demo',
            email: user?.email || 'demo@example.com'
          })
        },
        body: JSON.stringify({ count: 3 })
      });

      if (response.ok) {
        // Small delay to ensure backend has processed the notifications
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh notifications and show Mantine notifications for new ones
        await refreshStoredNotifications(true);
        
        notifications.show({
          title: 'Demo Notifications',
          message: 'Generated 3 demo notifications!',
          color: 'blue',
        });
      } else {
        throw new Error('Failed to generate demo notifications');
      }
    } catch (error) {
      console.error('Error generating demo notifications:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to generate demo notifications',
        color: 'red',
      });
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: (desktopOpened || isHovered) ? 255 : 80,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      {/* Header */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm" align="center">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
            <Burger
              opened={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />
            <Group align="center" style={{ height: '100%' }}>
              <Image
                src={colorScheme === 'dark' ? '/logo_banner_large_light.png' : '/logo_banner_large_dark.png'}
                alt="TaaskMaaster Logo"
                height={48}
                width="auto"
                fit="contain"
                style={{ display: 'block' }}
              />
            </Group>
          </Group>

          <Group gap="sm">
            {/* Demo Button */}
            {user && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconSparkles size={14} />}
                onClick={handleGenerateDemo}
                color="yellow"
                loading={isGeneratingDemo}
                disabled={isGeneratingDemo}
              >
                {isGeneratingDemo ? 'Generating...' : 'Demo'}
              </Button>
            )}

            {/* Notifications */}
            <NotificationBell />

            {/* User info in header on mobile */}
            {user && (
              <Text size="sm" hiddenFrom="sm" fw={500}>
                {user.username}
              </Text>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      {/* Sidebar Navigation */}
      <AppShell.Navbar 
        p={0}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ transition: 'width 0.15s ease-in-out' }}
      >
        {(desktopOpened || isHovered) ? (
          <NavbarNested
            currentPage={currentPage}
            onNavigate={onNavigate}
            user={user}
            onLogout={onLogout}
            hoverMode={!desktopOpened && isHovered}
          />
        ) : (
          <NavbarMinimal
            currentPage={currentPage}
            onNavigate={onNavigate}
            user={user}
            onLogout={onLogout}
          />
        )}
      </AppShell.Navbar>

      {/* Main Content */}
      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}