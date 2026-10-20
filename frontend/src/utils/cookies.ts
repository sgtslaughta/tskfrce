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
    
    setCookie('taaskmaaster_settings', JSON.stringify(updatedSettings), {
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
    const settingsCookie = getCookie('taaskmaaster_settings');
    
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

/**
 * @description Save login state
 */
export const saveLoginState = (userData: {
  userId: string;
  username: string;
  email: string;
  role?: string;
  token?: string;
  lastLogin: number;
}): void => {
  try {
    setCookie('taaskmaaster_user', JSON.stringify(userData), {
      days: 30, // Shorter expiry for login data
      secure: process.env.NODE_ENV === 'production', // Only secure in production
      sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    });
  } catch (error) {
    console.error('Failed to save login state:', error);
  }
};

/**
 * @description Get login state
 */
export const getLoginState = (): {
  userId: string;
  username: string;
  email: string;
  role?: string;
  token?: string;
  lastLogin: number;
} | null => {
  try {
    const loginCookie = getCookie('taaskmaaster_user');
    
    if (loginCookie) {
      return JSON.parse(loginCookie);
    }
  } catch (error) {
    console.error('Failed to parse login state:', error);
  }

  return null;
};

/**
 * @description Clear login state
 */
export const clearLoginState = (): void => {
  deleteCookie('taaskmaaster_user');
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

/**
 * @description Save sidebar state
 */
export const saveSidebarState = (collapsed: boolean): void => {
  saveUserSettings({ sidebarCollapsed: collapsed });
};

/**
 * @description Get sidebar state
 */
export const getSidebarState = (): boolean => {
  const settings = getUserSettings();
  return settings.sidebarCollapsed;
};

/**
 * @description Save notification preferences
 */
export const saveNotificationPreferences = (notifications: UserSettings['notifications']): void => {
  saveUserSettings({ notifications });
};

/**
 * @description Get notification preferences
 */
export const getNotificationPreferences = (): UserSettings['notifications'] => {
  const settings = getUserSettings();
  return settings.notifications;
};

/**
 * @description Save UI preferences
 */
export const saveUIPreferences = (ui: UserSettings['ui']): void => {
  saveUserSettings({ ui });
};

/**
 * @description Get UI preferences
 */
export const getUIPreferences = (): UserSettings['ui'] => {
  const settings = getUserSettings();
  return settings.ui;
};

/**
 * @description Save user preferences
 */
export const saveUserPreferences = (preferences: UserSettings['preferences']): void => {
  saveUserSettings({ preferences });
};

/**
 * @description Get user preferences
 */
export const getUserPreferences = (): UserSettings['preferences'] => {
  const settings = getUserSettings();
  return settings.preferences;
};

/**
 * @description Clear all user data
 */
export const clearAllUserData = (): void => {
  deleteCookie('taaskmaaster_settings');
  deleteCookie('taaskmaaster_user');
  // Clear any other app-specific cookies
  const cookies = document.cookie.split(';');
  cookies.forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    if (name.startsWith('taaskmaaster_')) {
      deleteCookie(name);
    }
  });
};

/**
 * @description Check if cookies are enabled
 */
export const areCookiesEnabled = (): boolean => {
  try {
    setCookie('taaskmaaster_test', 'test', { days: 1 });
    const testValue = getCookie('taaskmaaster_test');
    deleteCookie('taaskmaaster_test');
    return testValue === 'test';
  } catch (error) {
    return false;
  }
};
