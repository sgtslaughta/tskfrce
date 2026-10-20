/**
 * @fileoverview User Type Definitions for TaaskMaaster
 * @description TypeScript interfaces and types for user entities
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

/**
 * @description User role enumeration
 */
export enum UserRole {
  ADMIN = 'admin',
  ORGANIZER = 'organizer',
  USER = 'user'
}

/**
 * @description User status enumeration
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended'
}

/**
 * @description User online status enumeration
 */
export enum OnlineStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy'
}

/**
 * @description Brand colors interface for theming
 */
export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

/**
 * @description User preferences interface
 */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  brandColors?: BrandColors;
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
    mentions: boolean;
    assignments: boolean;
    comments: boolean;
    statusChanges: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'team';
    showOnlineStatus: boolean;
    showActivity: boolean;
  };
}

/**
 * @description User profile interface
 */
export interface UserProfile {
  bio?: string;
  avatar?: string;
  phone?: string;
  location?: string;
  department?: string;
  position?: string;
  skills?: string[];
  social?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
  };
}

/**
 * @description Main user interface
 */
export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  profile?: UserProfile;
  preferences?: UserPreferences;
  online_status?: OnlineStatus;
  last_seen?: string;
}

/**
 * @description User creation request interface
 */
export interface CreateUserRequest {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  role?: UserRole;
  profile?: Partial<UserProfile>;
}

/**
 * @description User update request interface
 */
export interface UpdateUserRequest {
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: UserRole;
  status?: UserStatus;
  profile?: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
}

/**
 * @description User search filters interface
 */
export interface UserSearchFilters {
  query?: string;
  role?: UserRole;
  status?: UserStatus;
  department?: string;
  skills?: string[];
  online_status?: OnlineStatus;
}

/**
 * @description User list response interface
 */
export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/**
 * @description User mention interface
 */
export interface UserMention {
  id: number;
  user: User;
  mentioned_in: 'comment' | 'message' | 'task';
  mentioned_in_id: number;
  created_at: string;
  read: boolean;
}

/**
 * @description User activity interface
 */
export interface UserActivity {
  id: number;
  user: User;
  action: string;
  entity_type: string;
  entity_id: number;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * @description User statistics interface
 */
export interface UserStats {
  tasks_created: number;
  tasks_assigned: number;
  tasks_completed: number;
  comments_made: number;
  messages_sent: number;
  achievements_earned: number;
  points_total: number;
  activity_streak: number;
}

/**
 * @description User with statistics interface
 */
export interface UserWithStats extends User {
  stats: UserStats;
}

/**
 * @description Type guard to check if a user is active
 */
export const isActiveUser = (user: User): boolean => {
  return user.is_active && user.status === UserStatus.ACTIVE;
};

/**
 * @description Type guard to check if a user is online
 */
export const isOnlineUser = (user: User): boolean => {
  return user.online_status === OnlineStatus.ONLINE;
};

/**
 * @description Helper to get user display name
 */
export const getUserDisplayName = (user: User): string => {
  return user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.username;
};

/**
 * @description Helper to get user initials
 */
export const getUserInitials = (user: User): string => {
  const firstName = user.first_name?.[0] || '';
  const lastName = user.last_name?.[0] || '';
  return (firstName + lastName).toUpperCase() || user.username?.[0]?.toUpperCase() || 'U';
};
