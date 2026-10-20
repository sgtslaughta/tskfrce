/**
 * @fileoverview Task Type Definitions for TaaskMaaster
 * @description Type definitions for tasks, statuses, priorities, and related data structures
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { User } from './user';
import { TaskComment } from './comment';
import { MediaAttachment } from './media';

/**
 * @description Task status enumeration
 */
export type TaskStatus = 
  | 'todo'
  | 'in_progress'
  | 'submitted_for_approval'
  | 'done'
  | 'cancelled'
  | 'assigned'
  | 'review'
  | 'completed';

/**
 * @description Task priority enumeration
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * @description Task type enumeration
 */
export type TaskType = 'feature' | 'bug' | 'improvement' | 'documentation' | 'maintenance';

/**
 * @description Task tag interface
 */
export interface TaskTag {
  id: number;
  name: string;
  color?: string;
  description?: string;
}

/**
 * @description Task attachment interface
 */
export interface TaskAttachment {
  id: number;
  task_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_at: string;
}

/**
 * @description Task watcher interface
 */
export interface TaskWatcher {
  id: number;
  task_id: number;
  user_id: number;
  user: User;
  added_at: string;
}

/**
 * @description Task dependency interface
 */
export interface TaskDependency {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  depends_on_task: Task;
  dependency_type: 'blocks' | 'requires' | 'related';
  created_at: string;
}



/**
 * @description Task interface
 */
export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  created_by_id: number;
  created_by: User;
  assigned_to_id?: number;
  assigned_to?: User;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  tags: TaskTag[];
  attachments: TaskAttachment[];
  watchers: TaskWatcher[];
  dependencies: TaskDependency[];
  comments: TaskComment[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
  is_template: boolean;
  template_id?: number;
  parent_task_id?: number;
  subtasks: Task[];
  metadata?: Record<string, any>;
}

/**
 * @description Task creation request interface
 */
export interface TaskCreateRequest {
  title: string;
  description: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  assigned_to_id?: number;
  due_date?: string;
  estimated_hours?: number;
  tags?: string[];
  parent_task_id?: number;
  template_id?: number;
  metadata?: Record<string, any>;
}

/**
 * @description Task update request interface
 */
export interface TaskUpdateRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  assigned_to_id?: number;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * @description Task list response interface
 */
export interface TaskListResponse {
  tasks: Task[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * @description Task search request interface
 */
export interface TaskSearchRequest {
  query?: string;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  type?: TaskType[];
  assigned_to_id?: number;
  created_by_id?: number;
  tags?: string[];
  due_date_from?: string;
  due_date_to?: string;
  skip?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * @description Task template interface
 */
export interface TaskTemplate {
  id: number;
  name: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  estimated_hours?: number;
  tags: TaskTag[];
  variables: string[];
  created_by_id: number;
  created_by: User;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  usage_count: number;
}

/**
 * @description Task list interface
 */
export interface TaskList {
  id: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  created_by_id: number;
  created_by: User;
  is_public: boolean;
  tasks: Task[];
  created_at: string;
  updated_at: string;
}

/**
 * @description Task activity interface
 */
export interface TaskActivity {
  id: number;
  task_id: number;
  user_id: number;
  user: User;
  activity_type: 'created' | 'updated' | 'status_changed' | 'assigned' | 'commented' | 'tagged';
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * @description Task statistics interface
 */
export interface TaskStats {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  average_completion_time: number;
  tasks_by_status: Record<TaskStatus, number>;
  tasks_by_priority: Record<TaskPriority, number>;
  tasks_by_type: Record<TaskType, number>;
  most_active_users: Array<{
    user: User;
    task_count: number;
  }>;
  recent_activity: TaskActivity[];
}
