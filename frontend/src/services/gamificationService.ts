/**
 * @fileoverview Gamification Service for TaaskMaaster
 * @description Service for handling gamification features with the backend API
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api';

/**
 * @description Points type enum
 */
export enum PointsType {
  TASK_COMPLETION = 'task_completion',
  GOAL_ACHIEVEMENT = 'goal_achievement',
  STREAK_BONUS = 'streak_bonus',
  ACHIEVEMENT = 'achievement',
  DAILY_LOGIN = 'daily_login',
  CUSTOM = 'custom',
}

/**
 * @description Points transaction interface
 */
export interface PointsTransaction {
  id: number;
  user_id: number;
  amount: number;
  points_type: PointsType;
  description?: string;
  reference_id?: number;
  reference_type?: string;
  created_at: string;
}

/**
 * @description User points summary interface
 */
export interface UserPointsSummary {
  user_id: number;
  total_points: number;
  current_level: number;
  points_to_next_level: number;
  total_transactions: number;
  recent_transactions: PointsTransaction[];
}

/**
 * @description Points list response interface
 */
export interface PointsListResponse {
  points: PointsTransaction[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * @description Achievement interface
 */
export interface Achievement {
  id: number;
  name: string;
  description: string;
  icon?: string;
  points_reward: number;
  criteria: any;
  created_at: string;
  updated_at: string;
}

/**
 * @description User achievement interface
 */
export interface UserAchievement {
  id: number;
  user_id: number;
  achievement_id: number;
  awarded_at: string;
  achievement: Achievement;
}

/**
 * @description Streak interface
 */
export interface Streak {
  id: number;
  user_id: number;
  streak_type: string;
  current_count: number;
  longest_count: number;
  last_activity_date: string;
  created_at: string;
  updated_at: string;
}

/**
 * @description Streak list response interface
 */
export interface StreakListResponse {
  streaks: Streak[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * @description Leaderboard entry interface
 */
export interface LeaderboardEntry {
  id: number;
  user_id: number;
  username: string;
  score: number;
  rank: number;
  created_at: string;
  updated_at: string;
}

/**
 * @description Leaderboard interface
 */
export interface Leaderboard {
  id: number;
  name: string;
  description?: string;
  type: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * @description Leaderboard list response interface
 */
export interface LeaderboardListResponse {
  leaderboards: Leaderboard[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * @description Leaderboard entry list response interface
 */
export interface LeaderboardEntryListResponse {
  entries: LeaderboardEntry[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * @description Gamification service class
 */
export class GamificationService {
  private static instance: GamificationService;

  /**
   * @description Get singleton instance
   */
  public static getInstance(): GamificationService {
    if (!GamificationService.instance) {
      GamificationService.instance = new GamificationService();
    }
    return GamificationService.instance;
  }

  /**
   * @description Get user points summary
   * @param userId - User ID
   * @returns Promise with user points summary
   */
  async getUserPointsSummary(userId: number): Promise<UserPointsSummary> {
    try {
      const response = await apiGet<UserPointsSummary>(`/gamification/points/summary/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch user points summary.');
    }
  }

  /**
   * @description Get user points history
   * @param userId - User ID
   * @param options - Pagination options
   * @returns Promise with points history
   */
  async getUserPointsHistory(
    userId: number,
    options: { skip?: number; limit?: number } = {}
  ): Promise<PointsListResponse> {
    try {
      const params = new URLSearchParams();
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());

      const url = `/gamification/points/history/${userId}?${params.toString()}`;
      const response = await apiGet<PointsListResponse>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch user points history.');
    }
  }

  /**
   * @description Award points to user
   * @param userId - User ID
   * @param amount - Points amount
   * @param pointsType - Type of points
   * @param description - Transaction description
   * @param referenceId - Reference ID
   * @param referenceType - Reference type
   * @returns Promise with points transaction
   */
  async awardPoints(
    userId: number,
    amount: number,
    pointsType: PointsType,
    description?: string,
    referenceId?: number,
    referenceType?: string
  ): Promise<PointsTransaction> {
    try {
      const params = new URLSearchParams();
      params.append('user_id', userId.toString());
      params.append('amount', amount.toString());
      params.append('points_type', pointsType);
      if (description) params.append('description', description);
      if (referenceId) params.append('reference_id', referenceId.toString());
      if (referenceType) params.append('reference_type', referenceType);

      const url = `/gamification/points/award?${params.toString()}`;
      const response = await apiPost<PointsTransaction>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to award points.');
    }
  }

  /**
   * @description Get user achievements
   * @param userId - User ID
   * @returns Promise with user achievements
   */
  async getUserAchievements(userId: number): Promise<UserAchievement[]> {
    try {
      const response = await apiGet<UserAchievement[]>(`/gamification/achievements/user/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch user achievements.');
    }
  }

  /**
   * @description Check and award achievements
   * @param userId - User ID
   * @returns Promise with newly awarded achievements
   */
  async checkAndAwardAchievements(userId: number): Promise<{ message: string; new_achievements: Array<{ id: number; name: string }> }> {
    try {
      const response = await apiPost<{ message: string; new_achievements: Array<{ id: number; name: string }> }>(
        `/gamification/achievements/check/${userId}`
      );
      return response.data;
    } catch (error) {
      throw new Error('Failed to check and award achievements.');
    }
  }

  /**
   * @description Get user streaks
   * @param userId - User ID
   * @param options - Pagination options
   * @returns Promise with user streaks
   */
  async getUserStreaks(
    userId: number,
    options: { skip?: number; limit?: number } = {}
  ): Promise<StreakListResponse> {
    try {
      const params = new URLSearchParams();
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());

      const url = `/gamification/streaks/user/${userId}?${params.toString()}`;
      const response = await apiGet<StreakListResponse>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch user streaks.');
    }
  }

  /**
   * @description Update user streak
   * @param userId - User ID
   * @param streakType - Type of streak
   * @returns Promise with updated streak
   */
  async updateUserStreak(userId: number, streakType: string): Promise<Streak> {
    try {
      const params = new URLSearchParams();
      params.append('user_id', userId.toString());
      params.append('streak_type', streakType);

      const url = `/gamification/streaks/update?${params.toString()}`;
      const response = await apiPost<Streak>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to update user streak.');
    }
  }

  /**
   * @description Get leaderboard entries
   * @param leaderboardId - Leaderboard ID
   * @param options - Pagination options
   * @returns Promise with leaderboard entries
   */
  async getLeaderboardEntries(
    leaderboardId: number,
    options: { skip?: number; limit?: number } = {}
  ): Promise<LeaderboardEntryListResponse> {
    try {
      const params = new URLSearchParams();
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());

      const url = `/gamification/leaderboards/${leaderboardId}/entries?${params.toString()}`;
      const response = await apiGet<LeaderboardEntryListResponse>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch leaderboard entries.');
    }
  }

  /**
   * @description Get dashboard statistics
   * @param userId - User ID
   * @returns Promise with dashboard statistics
   */
  async getDashboardStats(userId: number): Promise<{
    totalPoints: number;
    currentLevel: number;
    tasksCompleted: number;
    tasksPending: number;
    streakDays: number;
    achievements: number;
  }> {
    try {
      // Get points summary
      const pointsSummary = await this.getUserPointsSummary(userId);
      
      // Get user achievements
      const achievements = await this.getUserAchievements(userId);
      
      // Get user streaks
      const streaks = await this.getUserStreaks(userId);
      
      // Find the main task completion streak
      const taskStreak = streaks.streaks.find(s => s.streak_type === 'task_completion') || 
                        { current_count: 0, longest_count: 0 };

      return {
        totalPoints: pointsSummary.total_points,
        currentLevel: pointsSummary.current_level,
        tasksCompleted: 0, // TODO: Get from task service
        tasksPending: 0,   // TODO: Get from task service
        streakDays: taskStreak.current_count,
        achievements: achievements.length,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Return default values if API calls fail
      return {
        totalPoints: 0,
        currentLevel: 1,
        tasksCompleted: 0,
        tasksPending: 0,
        streakDays: 0,
        achievements: 0,
      };
    }
  }
}

/**
 * @description Export singleton instance
 */
export const gamificationService = GamificationService.getInstance();
