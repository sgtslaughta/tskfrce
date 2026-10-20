/**
 * @fileoverview Task Service for TaaskMaaster
 * @description Service for handling task operations with the backend API
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api';
import { User } from '../types/user';

/**
 * @description Task priority enum
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * @description Task status enum
 */
export enum TaskStatus {
  TODO = 'todo',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  SUBMITTED_FOR_APPROVAL = 'submitted_for_approval',
  REVIEW = 'review',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

/**
 * @description Task interface
 */
export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  points: number;
  reward_type?: string;
  reward_value?: number;
  reward_description?: string;
  is_recurring: boolean;
  recurrence_pattern?: any;
  template_id?: number;
  category_id?: number;
  created_by_id: number;
  assigned_to_id?: number;
  assigned_user?: User;
  parent_task_id?: number;
  created_at: string;
  updated_at: string;
  submitted_for_approval_at?: string;
  category?: TaskCategory;
  tags?: TaskTag[];
  subtasks?: Task[];
  attachments?: string[];
}

/**
 * @description Task category interface
 */
export interface TaskCategory {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * @description Task tag interface
 */
export interface TaskTag {
  id: number;
  name: string;
  color?: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * @description Task template interface
 */
export interface TaskTemplate {
  id: number;
  name: string;
  description?: string;
  category_id?: number;
  priority: TaskPriority;
  estimated_hours?: number;
  points: number;
  reward_type?: string;
  reward_value?: number;
  reward_description?: string;
  is_public: boolean;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  category?: TaskCategory;
}

/**
 * @description Create task request interface
 */
export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  estimated_hours?: number;
  points?: number;
  reward_type?: string;
  reward_value?: number;
  reward_description?: string;
  is_recurring?: boolean;
  recurrence_pattern?: any;
  template_id?: number;
  category_id?: number;
  assigned_to_id?: number;
  parent_task_id?: number;
  tags?: string[];
}

/**
 * @description Update task request interface
 */
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  points?: number;
  reward_type?: string;
  reward_value?: number;
  reward_description?: string;
  is_recurring?: boolean;
  recurrence_pattern?: any;
  template_id?: number;
  category_id?: number;
  assigned_to_id?: number;
  parent_task_id?: number;
  tags?: string[];
}

/**
 * @description Task list response interface
 */
export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

/**
 * @description Task get request interface
 */
export interface TaskGetRequest {
  task_id: number;
}

/**
 * @description Task complete request interface
 */
export interface TaskCompleteRequest {
  task_id: number;
  actual_hours?: number;
}

/**
 * @description Task update request interface
 */
export interface TaskUpdateRequest {
  task_id: number;
  updates: {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    due_date?: string;
    points?: number;
    reward_type?: string;
    reward_value?: number;
    reward_description?: string;
    is_recurring?: boolean;
    recurrence_pattern?: any;
    template_id?: number;
    category_id?: number;
    assigned_to_id?: number;
    parent_task_id?: number;
    tag_names?: string[];
  };
}

/**
 * @description Task delete request interface
 */
export interface TaskDeleteRequest {
  task_id: number;
}

/**
 * @description Create from template request interface
 */
export interface CreateFromTemplateRequest {
  template_id: number;
  title?: string;
  description?: string;
  assigned_to_id?: number;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimated_hours?: number;
  points?: number;
}

/**
 * @description Task filter options interface
 */
export interface TaskFilterOptions {
  skip?: number;
  limit?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  category_id?: number;
  assigned_to_id?: number;
  reward_type?: string;
  search?: string;
}

/**
 * @description Task service class
 */
export class TaskService {
  private static instance: TaskService;

  /**
   * @description Get singleton instance
   */
  public static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService();
    }
    return TaskService.instance;
  }

  /**
   * @description Get tasks with filtering and pagination
   * @param options - Filter options
   * @returns Promise with task list
   */
  async getTasks(options: TaskFilterOptions = {}): Promise<TaskListResponse> {
    try {
      const params = new URLSearchParams();
      
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.status) params.append('status', options.status);
      if (options.priority) params.append('priority', options.priority);
      if (options.category_id) params.append('category_id', options.category_id.toString());
      if (options.assigned_to_id) params.append('assigned_to_id', options.assigned_to_id.toString());
      if (options.reward_type) params.append('reward_type', options.reward_type);
      if (options.search) params.append('search', options.search);

      const url = `/tasks?${params.toString()}`;
      const response = await apiGet<TaskListResponse>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch tasks.');
    }
  }

  /**
   * @description Get a specific task by ID
   * @param taskId - Task ID
   * @returns Promise with task data
   */
  async getTask(taskId: number): Promise<Task> {
    try {
      const request: TaskGetRequest = { task_id: taskId };
      const response = await apiPost<Task>('/tasks/get', request);
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch task: ${error.message}`);
      }
      throw new Error('Failed to fetch task: Unknown error');
    }
  }

  /**
   * @description Create a new task
   * @param taskData - Task creation data
   * @returns Promise with created task
   */
  async createTask(taskData: CreateTaskRequest): Promise<Task> {
    try {
      const response = await apiPost<Task>('/tasks', taskData);
      return response.data;
    } catch (error) {
      throw new Error('Failed to create task.');
    }
  }

  /**
   * @description Update an existing task
   * @param taskId - Task ID
   * @param taskData - Task update data
   * @returns Promise with updated task
   */
  async updateTask(taskId: number, taskData: Partial<Task>): Promise<Task> {
    try {
      // Convert TaskTag[] to string[] if tags exist
      const updates = { ...taskData };
      let convertedTags: string[] | undefined;
      
      if (updates.tags && Array.isArray(updates.tags) && updates.tags.length > 0) {
        // Check if it's TaskTag[] and convert to string[]
        if (typeof updates.tags[0] === 'object' && 'name' in updates.tags[0]) {
          convertedTags = (updates.tags as TaskTag[]).map(tag => tag.name);
        } else {
          convertedTags = updates.tags as unknown as string[];
        }
      }

      // Create a properly typed updates object
      const typedUpdates: TaskUpdateRequest['updates'] = {
        title: updates.title,
        description: updates.description,
        status: updates.status,
        priority: updates.priority,
        due_date: updates.due_date,
        points: updates.points,
        reward_type: updates.reward_type,
        reward_value: updates.reward_value,
        reward_description: updates.reward_description,
        is_recurring: updates.is_recurring,
        recurrence_pattern: updates.recurrence_pattern,
        template_id: updates.template_id,
        category_id: updates.category_id,
        assigned_to_id: updates.assigned_to_id,
        parent_task_id: updates.parent_task_id,
        tag_names: convertedTags // Backend expects 'tag_names', not 'tags'
      };

      const request: TaskUpdateRequest = {
        task_id: taskId,
        updates: typedUpdates
      };
      
      const response = await apiPost<Task>('/tasks/update', request);
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to update task: ${error.message}`);
      }
      throw new Error('Failed to update task: Unknown error');
    }
  }

  /**
   * @description Delete a task
   * @param taskId - Task ID
   * @returns Promise indicating success
   */
  async deleteTask(taskId: number): Promise<void> {
    try {
      const request: TaskDeleteRequest = { task_id: taskId };
      await apiPost('/tasks/delete', request);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to delete task: ${error.message}`);
      }
      throw new Error('Failed to delete task: Unknown error');
    }
  }

  /**
   * @description Mark a task as completed
   * @param taskId - Task ID
   * @param actualHours - Actual hours spent (optional)
   * @returns Promise with updated task
   */
  async completeTask(taskId: number, actualHours?: number): Promise<Task> {
    try {
      const request: TaskCompleteRequest = {
        task_id: taskId,
        actual_hours: actualHours
      };
      const response = await apiPost<Task>('/tasks/complete', request);
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to complete task: ${error.message}`);
      }
      throw new Error('Failed to complete task: Unknown error');
    }
  }

  /**
   * @description Get task categories
   * @returns Promise with task categories
   */
  async getCategories(): Promise<TaskCategory[]> {
    try {
      const response = await apiGet<TaskCategory[]>('/tasks/categories');
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch task categories.');
    }
  }

  /**
   * @description Create a new task category
   * @param categoryData - Category creation data
   * @returns Promise with created category
   */
  async createCategory(categoryData: { name: string; description?: string; color?: string }): Promise<TaskCategory> {
    try {
      const response = await apiPost<TaskCategory>('/tasks/categories', categoryData);
      return response.data;
    } catch (error) {
      throw new Error('Failed to create task category.');
    }
  }

  /**
   * @description Get task tags
   * @returns Promise with task tags
   */
  async getTags(): Promise<TaskTag[]> {
    try {
      const response = await apiGet<TaskTag[]>('/tasks/tags');
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch task tags.');
    }
  }

  /**
   * @description Create a new task tag
   * @param tagData - Tag creation data
   * @returns Promise with created tag
   */
  async createTag(tagData: { name: string; color?: string }): Promise<TaskTag> {
    try {
      const response = await apiPost<TaskTag>('/tasks/tags', tagData);
      return response.data;
    } catch (error) {
      throw new Error('Failed to create task tag.');
    }
  }

  /**
   * @description Get task templates
   * @param includePublic - Include public templates
   * @returns Promise with task templates
   */
  async getTemplates(includePublic: boolean = true): Promise<TaskTemplate[]> {
    try {
      const response = await apiGet<TaskTemplate[]>(`/tasks/templates?include_public=${includePublic}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch task templates.');
    }
  }

  /**
   * @description Create a new task template
   * @param templateData - Template creation data
   * @returns Promise with created template
   */
  async createTemplate(templateData: {
    name: string;
    description?: string;
    estimated_hours?: number;
    points: number;
    category_id?: number;
    tags?: string[];
    is_public: boolean;
  }): Promise<TaskTemplate> {
    try {
      const response = await apiPost<TaskTemplate>('/tasks/templates', templateData);
      return response.data;
    } catch (error) {
      throw new Error('Failed to create task template.');
    }
  }

  /**
   * @description Create a task from a template
   * @param templateId - Template ID
   * @param customData - Custom task data to override template values
   * @returns Promise with created task
   */
  async createTaskFromTemplate(
    templateId: number,
    customData?: {
      title?: string;
      description?: string;
      assigned_to_id?: number;
      due_date?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      estimated_hours?: number;
      points?: number;
    }
  ): Promise<Task> {
    try {
      const request: CreateFromTemplateRequest = {
        template_id: templateId,
        ...customData
      };
      const response = await apiPost<Task>('/tasks/templates/create-from-template', request);
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create task from template: ${error.message}`);
      }
      throw new Error('Failed to create task from template: Unknown error');
    }
  }

  /**
   * @description Get recurring tasks
   * @param options - Filter options
   * @returns Promise with recurring tasks
   */
  async getRecurringTasks(options: { skip?: number; limit?: number } = {}): Promise<Task[]> {
    try {
      const params = new URLSearchParams();
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());

      const url = `/tasks/recurring?${params.toString()}`;
      const response = await apiGet<Task[]>(url);
      return response.data;
    } catch (error) {
      throw new Error('Failed to fetch recurring tasks.');
    }
  }

  /**
   * @description Create recurring task instances
   * @returns Promise with creation result
   */
  async createRecurringTasks(): Promise<{ message: string; created_count: number }> {
    try {
      const response = await apiPost<{ message: string; created_count: number }>('/tasks/recurring/create');
      return response.data;
    } catch (error) {
      throw new Error('Failed to create recurring tasks.');
    }
  }

  /**
   * @description Bulk update multiple tasks
   * @param bulkUpdateData - Bulk update data
   * @returns Promise with updated tasks
   */
  async bulkUpdateTasks(bulkUpdateData: {
    task_ids: number[];
    updates: Partial<Task>;
  }): Promise<Task[]> {
    try {
      const response = await apiPost<Task[]>('/tasks/bulk-update', bulkUpdateData);
      return response.data;
    } catch (error) {
      throw new Error('Failed to bulk update tasks.');
    }
  }

  /**
   * @description Export tasks in various formats
   * @param exportRequest - Export request data
   * @returns Promise with exported data
   */
  async exportTasks(exportRequest: {
    format: string;
    filters?: any;
    include_completed: boolean;
    date_range?: {
      start: Date;
      end: Date;
    };
  }): Promise<string> {
    try {
      const response = await apiPost<string>('/tasks/export', exportRequest);
      return response.data;
    } catch (error) {
      throw new Error('Failed to export tasks.');
    }
  }

  /**
   * @description Get available reward types
   * @returns Promise with reward types
   */
  async getRewardTypes(): Promise<Array<{
    value: string;
    label: string;
    description: string;
  }>> {
    try {
      const response = await apiGet<{ reward_types: Array<{
        value: string;
        label: string;
        description: string;
      }> }>('/tasks/reward-types');
      return response.data.reward_types;
    } catch (error) {
      throw new Error('Failed to fetch reward types.');
    }
  }

  /**
   * @description Get users for task assignment
   * @returns Promise with users list
   */
  async getUsers(): Promise<Array<{ id: number; username: string; email: string }>> {
    try {
      const response = await apiGet<{ 
        users: Array<{ 
          id: number; 
          username: string; 
          email: string; 
          full_name?: string; 
          is_active: boolean;
        }>;
        total: number;
      }>('/users/for-assignment');
      return response.data.users;
    } catch (error) {
      throw new Error('Failed to fetch users for assignment.');
    }
  }

}

/**
 * @description Export singleton instance
 */
export const taskService = TaskService.getInstance();
