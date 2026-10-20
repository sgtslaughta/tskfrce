/**
 * @fileoverview Theme Settings Component
 * @description Component for managing theme and brand color preferences
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React from 'react';
import {
  Box,
  Text,
  Card,
  Group,
  Button,
  ColorInput,
  Select,
  Stack,
  Badge,
  SimpleGrid,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconPalette, IconRefresh, IconCheck } from '@tabler/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import { colorPalettes, ColorPaletteName } from '../../utils/theme';

/**
 * @description Theme Settings component
 */
export const ThemeSettings: React.FC = () => {
  const { brandColors, setBrandColors, resetBrandColors, theme, setTheme } = useTheme();

  const handleColorChange = (colorType: keyof typeof brandColors, value: string) => {
    setBrandColors({ [colorType]: value });
  };

  const applyPalette = (paletteName: ColorPaletteName) => {
    setBrandColors(colorPalettes[paletteName]);
  };

  return (
    <Stack gap="lg">
      <Box>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <IconPalette size={20} />
            <Text size="lg" fw={600}>Theme Settings</Text>
          </Group>
          <Tooltip label="Reset to default colors">
            <ActionIcon variant="subtle" onClick={resetBrandColors}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* Theme Mode Selection */}
        <Card withBorder mb="lg">
          <Text size="sm" fw={500} mb="sm">Appearance</Text>
          <Select
            value={theme}
            onChange={(value) => setTheme(value as any)}
            data={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
            placeholder="Select theme mode"
          />
        </Card>

        {/* Brand Colors */}
        <Card withBorder mb="lg">
          <Text size="sm" fw={500} mb="sm">Brand Colors</Text>
          <SimpleGrid cols={1} spacing="sm">
            <ColorInput
              label="Primary Color"
              description="Main brand color used for primary actions and highlights"
              value={brandColors.primary}
              onChange={(value) => handleColorChange('primary', value)}
              format="hex"
              swatches={[
                '#3B82F6', '#1E40AF', '#2563EB', '#1D4ED8', '#1E3A8A',
                '#10B981', '#059669', '#047857', '#065F46', '#064E3B',
                '#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F',
              ]}
            />
            <ColorInput
              label="Secondary Color"
              description="Secondary brand color for complementary elements"
              value={brandColors.secondary}
              onChange={(value) => handleColorChange('secondary', value)}
              format="hex"
              swatches={[
                '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', '#4C1D95',
                '#EC4899', '#DB2777', '#BE185D', '#9D174D', '#831843',
                '#F97316', '#EA580C', '#C2410C', '#9A3412', '#7C2D12',
              ]}
            />
            <ColorInput
              label="Accent Color"
              description="Accent color for success states and special highlights"
              value={brandColors.accent}
              onChange={(value) => handleColorChange('accent', value)}
              format="hex"
              swatches={[
                '#10B981', '#059669', '#047857', '#065F46', '#064E3B',
                '#84CC16', '#65A30D', '#4D7C0F', '#365314', '#1A2E05',
                '#06B6D4', '#0891B2', '#0E7490', '#155E75', '#164E63',
              ]}
            />
          </SimpleGrid>
        </Card>

        {/* Quick Palette Selection */}
        <Card withBorder>
          <Text size="sm" fw={500} mb="sm">Quick Color Palettes</Text>
          <Text size="xs" c="dimmed" mb="md">
            Click on a palette to apply all three colors at once
          </Text>
          <SimpleGrid cols={3} spacing="sm">
            {Object.entries(colorPalettes).map(([name, palette]) => (
              <Card
                key={name}
                p="sm"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => applyPalette(name as ColorPaletteName)}
              >
                <Stack gap="xs" align="center">
                  <Group gap="xs" justify="center">
                    <Box
                      w={20}
                      h={20}
                      style={{
                        backgroundColor: palette.primary,
                        borderRadius: '50%',
                        border: '1px solid var(--mantine-color-gray-3)',
                      }}
                    />
                    <Box
                      w={20}
                      h={20}
                      style={{
                        backgroundColor: palette.secondary,
                        borderRadius: '50%',
                        border: '1px solid var(--mantine-color-gray-3)',
                      }}
                    />
                    <Box
                      w={20}
                      h={20}
                      style={{
                        backgroundColor: palette.accent,
                        borderRadius: '50%',
                        border: '1px solid var(--mantine-color-gray-3)',
                      }}
                    />
                  </Group>
                  <Badge variant="light" size="xs">
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </Badge>
                  {JSON.stringify(brandColors) === JSON.stringify(palette) && (
                    <IconCheck size={14} color="var(--mantine-color-green-6)" />
                  )}
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Card>

        {/* Color Preview */}
        <Card withBorder mt="lg">
          <Text size="sm" fw={500} mb="sm">Preview</Text>
          <Group gap="sm">
            <Button color="primary">Primary Button</Button>
            <Button color="secondary" variant="light">Secondary Button</Button>
            <Button color="accent" variant="outline">Accent Button</Button>
          </Group>
        </Card>
      </Box>
    </Stack>
  );
};