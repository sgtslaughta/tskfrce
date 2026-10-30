/**
 * @description Cookie utility functions for managing user settings and preferences
 */

/**
 * @description Brand colors interface for theming
 */
export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

/**
 * @description User settings interface
 */
export interface UserSettings {
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
  /** Brand colors for theming */
  brandColors?: BrandColors;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Language preference */
  language: string;
  /** Notification preferences */
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
  /** UI preferences */
  ui: {
    compactMode: boolean;
    showAnimations: boolean;
    autoSave: boolean;
  };
  /** Last login timestamp */
  lastLogin?: number;
  /** User preferences */
  preferences: {
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    showTaskWarnings?: boolean;
  };
}

/**
 * @description Default user settings
 */
export const defaultSettings: UserSettings = {
  theme: 'system',
  sidebarCollapsed: false,
  language: 'en',
  notifications: {
    email: true,
    push: true,
    sound: true,
  },
  ui: {
    compactMode: false,
    showAnimations: true,
    autoSave: true,
  },
  preferences: {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    showTaskWarnings: true,
  },
};

/**
 * @description Set a cookie with options
 */
export const setCookie = (
  name: string,
  value: string,
  options: {
    days?: number;
    path?: string;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  } = {}
): void => {
  const {
    days = 365,
    path = '/',
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'None',
  } = options;

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  const cookieValue = encodeURIComponent(value);
  const cookieOptions = [
    `expires=${expires.toUTCString()}`,
    `path=${path}`,
    `sameSite=${sameSite}`,
  ];

  if (secure) {
    cookieOptions.push('secure');
  }

  document.cookie = `${name}=${cookieValue}; ${cookieOptions.join('; ')}`;
};

/**
 * @description Get a cookie value
 */
export const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;

  const nameEQ = name + '=';
  const ca = document.cookie.split(';');

  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }

  return null;
};

/**
 * @description Delete a cookie
 */
export const deleteCookie = (name: string, path: string = '/'): void => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
};

/**
 * @description Save user settings to cookies
 */
export const saveUserSettings = (settings: Partial<UserSettings>): void => {
  try {
    const currentSettings = getUserSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    
    setCookie('task4ce_settings', JSON.stringify(updatedSettings), {
      days: 365,
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    });
  } catch (error) {
    console.error('Failed to save user settings:', error);
  }
};

/**
 * @description Get user settings from cookies
 */
export const getUserSettings = (): UserSettings => {
  try {
    const settingsCookie = getCookie('task4ce_settings');
    
    if (settingsCookie) {
      const parsedSettings = JSON.parse(settingsCookie);
      // Merge with defaults to ensure all properties exist
      return { ...defaultSettings, ...parsedSettings };
    }
  } catch (error) {
    console.error('Failed to parse user settings:', error);
  }

  return { ...defaultSettings };
};

/** Non-secret login state (UX only). The access token never goes in a cookie. */
export interface LoginState {
  userId: string;
  username: string;
  email: string;
  role?: string;
  lastLogin: number;
}

/**
 * @description Save login state (any `token` field is dropped)
 */
export const saveLoginState = (userData: LoginState & { token?: unknown }): void => {
  try {
    const { token, ...safe } = userData;
    setCookie('task4ce_user', JSON.stringify(safe), { days: 30, sameSite: 'Lax' });
  } catch (error) {
    console.error('Failed to save login state:', error);
  }
};

/**
 * @description Get login state. Migrates old cookies that still carry the JWT by
 * rewriting them without it (the token itself lives in localStorage via tokenStorage).
 */
export const getLoginState = (): LoginState | null => {
  try {
    const loginCookie = getCookie('task4ce_user');

    if (loginCookie) {
      const parsed = JSON.parse(loginCookie);
      if (parsed && 'token' in parsed) saveLoginState(parsed);
      const { token, ...safe } = parsed;
      return safe;
    }
  } catch (error) {
    console.error('Failed to parse login state:', error);
    clearLoginState(); // unreadable cookie: drop it, user re-logs if no stored token
  }

  return null;
};

/**
 * @description Clear login state
 */
export const clearLoginState = (): void => {
  deleteCookie('task4ce_user');
};

/**
 * @description Save theme preference
 */
export const saveThemePreference = (theme: 'light' | 'dark' | 'system'): void => {
  saveUserSettings({ theme });
};

/**
 * @description Get theme preference
 */
export const getThemePreference = (): 'light' | 'dark' | 'system' => {
  const settings = getUserSettings();
  return settings.theme;
};
