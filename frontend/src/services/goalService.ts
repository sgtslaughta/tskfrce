/**
 * @fileoverview Goal Service for TaaskMaaster
 * @description Service for handling goal management and progress tracking with the backend API
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api';

/**
 * @description Goal status enum
 */
export enum GoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

/**
 * @description Goal type enum
 */
export enum GoalType {
  TASK_COUNT = 'task_count',
  POINTS = 'points',
  STREAK = 'streak',
  TIME_SPENT = 'time_spent',
  CUSTOM = 'custom',
}

/**
 * @description Goal interface
 */
export interface Goal {
  id: number;
  title: string;
  description?: string;
  goal_type: GoalType;
  target_value: number;
  current_value: number;
  status: GoalStatus;
  start_date: string;
  end_date?: string;
  completed_at?: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * @description Goal create request interface
 */
export interface GoalCreateRequest {
  title: string;
  description?: string;
  goal_type: GoalType;
  target_value: number;
  start_date: string;
  end_date?: string;
}

/**
 * @description Goal update request interface
 */
export interface GoalUpdateRequest {
  title?: string;
  description?: string;
  target_value?: number;
  status?: GoalStatus;
  end_date?: string;
}

/**
 * @description Goal list response interface
 */
export interface GoalListResponse {
  goals: Goal[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * @description Goal progress interface
 */
export interface GoalProgress {
  id: number;
  goal_id: number;
  value: number;
  description?: string;
  recorded_at: string;
  created_at: string;
}

/**
 * @description Goal progress create request interface
 */
export interface GoalProgressCreateRequest {
  goal_id: number;
  value: number;
  description?: string;
}

/**
 * @description Goal progress list response interface
 */
export interface GoalProgressListResponse {
  progress: GoalProgress[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * @description Goal service class
 */
export class GoalService {
  private static instance: GoalService;

  /**
   * @description Get singleton instance
   */
  public static getInstance(): GoalService {
    if (!GoalService.instance) {
      GoalService.instance = new GoalService();
    }
    return GoalService.instance;
  }

  /**
   * @description Get goals with filtering and pagination
   * @param options - Filter and pagination options
   * @returns Promise with goal list
   */
  async getGoals(options: {
    skip?: number;
    limit?: number;
    status?: GoalStatus;
    goal_type?: GoalType;
    is_completed?: boolean;
  } = {}): Promise<GoalListResponse> {
    try {
      const params = new URLSearchParams();
      
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.status) params.append('status', options.status);
      if (options.goal_type) params.append('goal_type', options.goal_type);
      if (options.is_completed !== undefined) params.append('is_completed', options.is_completed.toString());

      const url = `/goals?${params.toString()}`;
      const response = await apiGet<GoalListResponse>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch goals.');
    }
  }

  /**
   * @description Get a specific goal by ID
   * @param goalId - Goal ID
   * @returns Promise with goal data
   */
  async getGoal(goalId: number): Promise<Goal> {
    try {
      const response = await apiGet<Goal>(`/goals/${goalId}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch goal.');
    }
  }

  /**
   * @description Create a new goal
   * @param goalData - Goal creation data
   * @returns Promise with created goal
   */
  async createGoal(goalData: GoalCreateRequest): Promise<Goal> {
    try {
      const response = await apiPost<Goal>('/goals', goalData);
      return response.data;
    } catch (error) {
      throw new Error('Failed to create goal.');
    }
  }

  /**
   * @description Update an existing goal
   * @param goalId - Goal ID
   * @param goalData - Goal update data
   * @returns Promise with updated goal
   */
  async updateGoal(goalId: number, goalData: GoalUpdateRequest): Promise<Goal> {
    try {
      const response = await apiPut<Goal>(`/goals/${goalId}`, goalData);
      return response.data;
    } catch (error) {
      throw new Error('Failed to update goal.');
    }
  }

  /**
   * @description Delete a goal
   * @param goalId - Goal ID
   * @returns Promise indicating success
   */
  async deleteGoal(goalId: number): Promise<void> {
    try {
      await apiDelete(`/goals/${goalId}`);
    } catch (error) {
      throw new Error('Failed to delete goal.');
    }
  }

  /**
   * @description Get goal progress
   * @param goalId - Goal ID
   * @param options - Pagination options
   * @returns Promise with goal progress
   */
  async getGoalProgress(
    goalId: number,
    options: { skip?: number; limit?: number } = {}
  ): Promise<GoalProgressListResponse> {
    try {
      const params = new URLSearchParams();
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());

      const url = `/goals/${goalId}/progress?${params.toString()}`;
      const response = await apiGet<GoalProgressListResponse>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch goal progress.');
    }
  }

  /**
   * @description Add progress to a goal
   * @param goalId - Goal ID
   * @param progressData - Progress data
   * @returns Promise with created progress entry
   */
  async addGoalProgress(goalId: number, progressData: GoalProgressCreateRequest): Promise<GoalProgress> {
    try {
      const response = await apiPost<GoalProgress>(`/goals/${goalId}/progress`, progressData);
      return response.data;
    } catch (error) {
      throw new Error('Failed to add goal progress.');
    }
  }

  /**
   * @description Get all goal progress entries
   * @param options - Pagination options
   * @returns Promise with all goal progress
   */
  async getAllGoalProgress(
    options: { skip?: number; limit?: number } = {}
  ): Promise<GoalProgressListResponse> {
    try {
      const params = new URLSearchParams();
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());

      const url = `/goals/progress?${params.toString()}`;
      const response = await apiGet<GoalProgressListResponse>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch goal progress.');
    }
  }

  /**
   * @description Get dashboard goal statistics
   * @returns Promise with goal statistics
   */
  async getDashboardGoalStats(): Promise<{
    activeGoals: number;
    completedGoals: number;
    totalProgress: number;
    recentGoals: Goal[];
  }> {
    try {
      // Get active goals
      const activeGoalsResponse = await this.getGoals({ 
        status: GoalStatus.ACTIVE, 
        limit: 100 
      });
      
      // Get completed goals
      const completedGoalsResponse = await this.getGoals({ 
        is_completed: true, 
        limit: 100 
      });

      // Get recent goals (last 5)
      const recentGoalsResponse = await this.getGoals({ 
        limit: 5 
      });

      return {
        activeGoals: activeGoalsResponse.total,
        completedGoals: completedGoalsResponse.total,
        totalProgress: 0, // TODO: Calculate from progress data
        recentGoals: recentGoalsResponse.goals,
      };
    } catch (error) {
      console.error('Error fetching goal stats:', error);
      return {
        activeGoals: 0,
        completedGoals: 0,
        totalProgress: 0,
        recentGoals: [],
      };
    }
  }
}

/**
 * @description Export singleton instance
 */
export const goalService = GoalService.getInstance();
