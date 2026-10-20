import { IconChevronDown } from '@tabler/icons-react';
import { ActionIcon, Button, Group, Menu, useMantineTheme } from '@mantine/core';
import { ReactNode } from 'react';
import classes from './SplitButton.module.css';

interface SplitButtonProps {
  /** Main button label */
  children: ReactNode;
  /** Main button click handler */
  onClick?: () => void;
  /** Left section icon for main button */
  leftSection?: ReactNode;
  /** Menu items to display in dropdown */
  menuItems: Array<{
    label: ReactNode;
    leftSection?: ReactNode;
    onClick?: () => void;
    color?: string;
    disabled?: boolean;
  }>;
  /** Button variant */
  variant?: string;
  /** Button size */
  size?: string;
  /** Disabled state for main button */
  disabled?: boolean;
}

export function SplitButton({ 
  children, 
  onClick, 
  leftSection, 
  menuItems,
  variant = 'filled',
  size = 'md',
  disabled = false 
}: SplitButtonProps) {
  const theme = useMantineTheme();

  // Map button sizes to ActionIcon heights to match exactly
  const getActionIconHeight = (buttonSize: string) => {
    switch (buttonSize) {
      case 'xs': return '1.875rem'; // 30px
      case 'sm': return '2.25rem';  // 36px - matches small button height
      case 'md': return '2.25rem';  // 36px - matches medium button height  
      case 'lg': return '2.75rem';  // 44px
      case 'xl': return '3.125rem'; // 50px
      default: return '2.25rem';
    }
  };

  return (
    <Group wrap="nowrap" gap={0}>
      <Button 
        className={classes.button}
        onClick={onClick}
        leftSection={leftSection}
        variant={variant}
        size={size}
        disabled={disabled}
      >
        {children}
      </Button>
      <Menu transitionProps={{ transition: 'pop' }} position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="filled"
            color={theme.primaryColor}
            className={classes.menuControl}
            style={{
              height: getActionIconHeight(size),
              width: getActionIconHeight(size),
            }}
          >
            <IconChevronDown size={16} stroke={1.5} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {menuItems.map((item, index) => (
            <Menu.Item
              key={index}
              leftSection={item.leftSection}
              onClick={item.onClick}
              color={item.color}
              disabled={item.disabled}
            >
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
