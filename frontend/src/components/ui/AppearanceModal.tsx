/**
 * @fileoverview AppearanceModal Component
 * @description Modal for appearance and theme settings
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Switch,
  Button,
  Card,
  Box,
  ThemeIcon
} from '@mantine/core';
import {
  IconSun,
  IconMoon,
  IconPalette,
  IconDeviceDesktop
} from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';

interface AppearanceModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Function to close the modal */
  onClose: () => void;
}

export function AppearanceModal({ opened, onClose }: AppearanceModalProps) {
  const { theme, setTheme, isDarkMode } = useTheme();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconPalette size={20} stroke={1.5} />
          <Text size="lg" fw={600}>
            Appearance
          </Text>
        </Group>
      }
      size="md"
      centered
    >
      <Stack gap="md">
        <Text size="sm" fw={500} c="dimmed" tt="uppercase">
          Theme Preference
        </Text>
        
        {/* Manual Theme Toggle */}
        <Card 
          withBorder 
          p="lg"
          style={{
            borderColor: theme !== 'system' 
              ? 'var(--mantine-primary-color-filled)' 
              : undefined,
            backgroundColor: theme !== 'system' 
              ? 'var(--mantine-primary-color-light)' 
              : undefined
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="md">
              <ThemeIcon
                size="xl"
                variant="light"
                color={isDarkMode ? 'yellow' : 'blue'}
              >
                {isDarkMode ? <IconMoon size={24} /> : <IconSun size={24} />}
              </ThemeIcon>
              <Box>
                <Text size="md" fw={500}>
                  Manual Theme
                </Text>
                <Text size="sm" c="dimmed">
                  {theme !== 'system' ? 
                    `Currently: ${isDarkMode ? 'Dark Mode' : 'Light Mode'}` :
                    'Choose light or dark theme manually'
                  }
                </Text>
              </Box>
            </Group>
            <Switch
              size="lg"
              checked={isDarkMode}
              disabled={theme === 'system'}
              onChange={(event) => {
                setTheme(event.currentTarget.checked ? 'dark' : 'light');
              }}
              onLabel={<IconMoon size={16} stroke={1.5} />}
              offLabel={<IconSun size={16} stroke={1.5} />}
            />
          </Group>
        </Card>

        {/* System Theme Option */}
        <Card 
          withBorder 
          p="lg"
          style={{
            cursor: 'pointer',
            borderColor: theme === 'system' 
              ? 'var(--mantine-primary-color-filled)' 
              : undefined,
            backgroundColor: theme === 'system' 
              ? 'var(--mantine-primary-color-light)' 
              : undefined
          }}
          onClick={() => setTheme(theme === 'system' ? (isDarkMode ? 'dark' : 'light') : 'system')}
        >
          <Group gap="md" align="center">
            <ThemeIcon
              size="xl"
              variant={theme === 'system' ? 'filled' : 'light'}
              color="primary"
            >
              <IconDeviceDesktop size={24} />
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text size="md" fw={500}>
                Follow System Theme
              </Text>
              <Text size="sm" c="dimmed">
                {theme === 'system' ? 
                  `Currently following system (${isDarkMode ? 'Dark' : 'Light'})` :
                  'Automatically switch based on your device settings'
                }
              </Text>
            </Box>
            {theme === 'system' && (
              <Text size="xs" c="primary" fw={500}>
                Active
              </Text>
            )}
          </Group>
        </Card>

        {/* Actions */}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}