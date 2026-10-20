import { useState } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { Box, Collapse, Group, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import classes from './NavbarLinksGroup.module.css';

interface LinksGroupProps {
  icon: React.FC<any>;
  label: string;
  initiallyOpened?: boolean;
  links?: { label: string; link: string }[];
  onClick?: () => void;
  active?: boolean;
  hoverMode?: boolean;
}

export function LinksGroup({ 
  icon: Icon, 
  label, 
  initiallyOpened, 
  links, 
  onClick,
  active = false,
  hoverMode = false
}: LinksGroupProps) {
  const hasLinks = Array.isArray(links);
  const [opened, setOpened] = useState(initiallyOpened || false);
  const [hovered, setHovered] = useState(false);
  
  const handleClick = () => {
    if (hasLinks && !hoverMode) {
      setOpened((o) => !o);
    } else if (onClick) {
      onClick();
    }
  };

  const handleMouseEnter = () => {
    if (hasLinks && hoverMode) {
      setHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (hasLinks && hoverMode) {
      setHovered(false);
    }
  };

  const items = (hasLinks ? links : []).map((link) => (
    <Text
      component='a'
      className={classes.link}
      href={link.link}
      key={link.label}
      onClick={(event) => {
        event.preventDefault();
        console.log('Navigate to:', link.link);
      }}
    >
      {link.label}
    </Text>
  ));

  // Determine if links should be shown
  const shouldShowLinks = hoverMode ? hovered : opened;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <UnstyledButton 
        onClick={handleClick} 
        className={classes.control}
        data-active={active || undefined}
      >
        <Group justify="space-between" gap={0}>
          <Box style={{ display: 'flex', alignItems: 'center' }}>
            <ThemeIcon 
              variant="light" 
              size={30}
            >
              <Icon size={18} />
            </ThemeIcon>
            <Box ml="md">{label}</Box>
          </Box>
          {hasLinks && (
            <IconChevronRight
              className={classes.chevron}
              stroke={1.5}
              size={16}
              style={{ 
                transform: shouldShowLinks ? 'rotate(-90deg)' : 'none'
              }}
            />
          )}
        </Group>
      </UnstyledButton>
      {hasLinks ? (
        <Collapse in={shouldShowLinks}>
          <div className={classes.links}>{items}</div>
        </Collapse>
      ) : null}
    </div>
  );
}