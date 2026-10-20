/**
 * @fileoverview Global type declarations for TaaskMaaster
 * @description Custom type declarations for external modules
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

// Mantine Core types
declare module '@mantine/core' {
  export * from '@mantine/core';
}

// Tabler Icons types
declare module '@tabler/icons-react' {
  export * from '@tabler/icons-react';
}

// Heroicons types
declare module '@heroicons/react/24/outline' {
  export * from '@heroicons/react/24/outline';
}

declare module '@heroicons/react/24/solid' {
  export * from '@heroicons/react/24/solid';
}


// Date-fns types
declare module 'date-fns' {
  export * from 'date-fns';
}

// Tailwind merge types
declare module 'tailwind-merge' {
  export function twMerge(...inputs: any[]): string;
}

// Lodash types
declare module 'lodash' {
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: {
      leading?: boolean;
      trailing?: boolean;
      maxWait?: number;
    }
  ): T & { cancel(): void; flush(): void };
  
  export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: {
      leading?: boolean;
      trailing?: boolean;
    }
  ): T & { cancel(): void; flush(): void };
  
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: {
      leading?: boolean;
      trailing?: boolean;
      maxWait?: number;
    }
  ): T & { cancel(): void; flush(): void };
  
  export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: {
      leading?: boolean;
      trailing?: boolean;
    }
  ): T & { cancel(): void; flush(): void };
}

// Global type augmentations
declare global {
  interface Window {
    // Add any global window properties here
  }
}

export {};
