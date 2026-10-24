/**
 * @fileoverview Parent icon component using Material Symbols Rounded
 */

import React from 'react';

interface IconProps {
  name: string;
  fill?: boolean;
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Icon component using Material Symbols Rounded ligatures
 * Renders as a <span class="ms"> containing the icon name as text
 */
export const Icon: React.FC<IconProps> = ({
  name,
  fill = false,
  size = 24,
  label,
  className = ''
}) => {
  const classes = ['ms', className, fill && 'ms-filled'].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      style={{ fontSize: size }}
      aria-hidden={!label}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {name}
    </span>
  );
};
