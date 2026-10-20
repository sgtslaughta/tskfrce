/**
 * Workflow Type Definitions
 * 
 * Type definitions for workflow-related data structures including
 * status history, transitions, approvals, and workflow events.
 */

import { TaskStatus } from './task';
import { User } from './user';

export interface TaskStatusHistory {
  id: number;
  task_id: number;
  previous_status: TaskStatus | null;
  new_status: TaskStatus;
  user_id: number | null;
  user: User | null;
  comment?: string;
  reason?: string;
  created_at: string;
  is_system_generated: boolean;
  metadata?: Record<string, any>;
}

export interface WorkflowTransition {
  from_status: TaskStatus;
  to_status: TaskStatus;
  required_permission: string;
  validation_rules: string[];
  auto_trigger_conditions?: string[];
  notification_config: {
    notify_assignee: boolean;
    notify_creator: boolean;
    notify_watchers: boolean;
    email_template?: string;
    websocket_event: string;
  };
}

export interface WorkflowRule {
  id: number;
  name: string;
  description: string;
  task_type?: string;
  priority: number;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowCondition {
  type: 'status' | 'user_role' | 'time_elapsed' | 'custom';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
  field?: string;
}

export interface WorkflowAction {
  type: 'transition' | 'notify' | 'assign' | 'create_comment' | 'custom';
  parameters: Record<string, any>;
  delay_seconds?: number;
}

export interface WorkflowEvent {
  id: number;
  event_type: 'status_changed' | 'approved' | 'rejected' | 'assigned' | 'commented';
  task_id: number;
  user_id: number | null;
  data: Record<string, any>;
  created_at: string;
  processed: boolean;
  error_message?: string;
}

export interface ApprovalRequest {
  id: number;
  task_id: number;
  requested_by_user_id: number;
  requested_by: User;
  assigned_to_user_id: number;
  assigned_to: User;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  comment?: string;
  reason?: string;
  requested_at: string;
  responded_at?: string;
  expires_at?: string;
}

export interface WorkflowStats {
  total_tasks: number;
  status_distribution: Record<TaskStatus, number>;
  average_completion_time: number;
  approval_rate: number;
  rejection_rate: number;
  bottleneck_status: TaskStatus | null;
  most_active_users: Array<{
    user: User;
    task_count: number;
    avg_completion_time: number;
  }>;
  recent_transitions: Array<{
    task_id: number;
    task_title: string;
    from_status: TaskStatus;
    to_status: TaskStatus;
    user: User;
    timestamp: string;
  }>;
}

export interface WorkflowTemplate {
  id: number;
  name: string;
  description: string;
  task_type: string;
  status_flow: Array<{
    status: TaskStatus;
    required_permissions: string[];
    auto_transitions: TaskStatus[];
    approval_required: boolean;
    max_duration_hours?: number;
  }>;
  notification_settings: {
    on_status_change: boolean;
    on_approval_request: boolean;
    on_rejection: boolean;
    email_notifications: boolean;
    websocket_notifications: boolean;
  };
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTransition {
  id: number;
  task_id: number;
  from_status: TaskStatus;
  to_status: TaskStatus;
  scheduled_at: string;
  condition?: string;
  comment?: string;
  created_by_user_id: number;
  created_by: User;
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  executed_at?: string;
  error_message?: string;
  created_at: string;
}

export interface WorkflowMetrics {
  period: string;
  tasks_created: number;
  tasks_completed: number;
  tasks_approved: number;
  tasks_rejected: number;
  average_cycle_time: number;
  status_transitions: Array<{
    from_status: TaskStatus;
    to_status: TaskStatus;
    count: number;
    average_duration: number;
  }>;
  user_activity: Array<{
    user: User;
    transitions_made: number;
    approvals_given: number;
    rejections_given: number;
  }>;
}

export interface WorkflowNotification {
  id: number;
  type: 'status_changed' | 'approval_requested' | 'approved' | 'rejected' | 'assigned';
  task_id: number;
  task_title: string;
  from_user_id: number | null;
  from_user: User | null;
  to_user_id: number;
  to_user: User;
  message: string;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
  read_at?: string;
}

// Workflow permission types
export type WorkflowPermission = 
  | 'can_transition_status'
  | 'can_approve_tasks'
  | 'can_reject_tasks'
  | 'can_assign_tasks'
  | 'can_view_workflow_history'
  | 'can_create_workflow_rules'
  | 'can_modify_workflow_rules'
  | 'can_schedule_transitions'
  | 'can_view_workflow_analytics';

// Workflow event types for WebSocket
export type WorkflowWebSocketEvent = 
  | 'workflow_status_changed'
  | 'workflow_approval_requested'
  | 'workflow_approved'
  | 'workflow_rejected'
  | 'workflow_assigned'
  | 'workflow_transition_scheduled'
  | 'workflow_transition_failed'
  | 'workflow_rule_triggered';

export interface WorkflowWebSocketMessage {
  event: WorkflowWebSocketEvent;
  task_id: number;
  user_id: number;
  data: {
    previous_status?: TaskStatus;
    new_status?: TaskStatus;
    comment?: string;
    reason?: string;
    timestamp: string;
    user: User;
    [key: string]: any;
  };
}
