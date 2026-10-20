/**
 * Type declarations for lodash modules
 * Temporary fix for TypeScript compilation issues
 */

declare module 'lodash/debounce' {
  const debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: {
      leading?: boolean;
      trailing?: boolean;
      maxWait?: number;
    }
  ) => T & { cancel(): void; flush(): void };
  export = debounce;
}

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
}
