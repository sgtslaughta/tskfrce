/**
 * @fileoverview Workflow Service for TaaskMaaster
 * @description Service for handling task workflow transitions with proper notifications
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { apiPost, ApiResponse, api } from './api';

/**
 * @description Workflow transition request interface
 */
export interface WorkflowTransitionRequest {
  task_id: number;
  new_status: string;
  comment?: string;
  force?: boolean;
}

/**
 * @description Workflow transition response interface
 */
export interface WorkflowTransitionResponse {
  success: boolean;
  message: string;
  task_id: number;
  previous_status: string;
  new_status: string;
  transitioned_by: number;
  comment?: string;
}

/**
 * @description User data interface for workflow API
 */
export interface WorkflowUser {
  id: string;
  username: string;
  role: string;
}

/**
 * @description Valid transitions response interface
 */
export interface ValidTransitionsResponse {
  valid_transitions: string[];
}

/**
 * @description Workflow service class
 */
export class WorkflowService {
  private static instance: WorkflowService;

  /**
   * @description Get singleton instance
   */
  public static getInstance(): WorkflowService {
    if (!WorkflowService.instance) {
      WorkflowService.instance = new WorkflowService();
    }
    return WorkflowService.instance;
  }

  /**
   * @description Create X-User-Data header for workflow API
   * @param user - Current user information
   * @returns X-User-Data header value
   */
  private createUserDataHeader(user: WorkflowUser): string {
    return JSON.stringify({
      user_id: parseInt(user.id),
      username: user.username,
      role: user.role
    });
  }

  /**
   * @description Transition a task to a new status with proper notifications
   * @param request - Transition request data
   * @param user - Current user information
   * @returns Promise with transition response
   */
  async transitionTaskStatus(request: WorkflowTransitionRequest, user: WorkflowUser): Promise<WorkflowTransitionResponse> {
    try {
      const response = await api.post<WorkflowTransitionResponse>('/workflow/transition', request, {
        headers: {
          'X-User-Data': this.createUserDataHeader(user)
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(`Failed to transition task status: ${error.response.data.detail}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to transition task status: ${error.message}`);
      }
      throw new Error('Failed to transition task status: Unknown error');
    }
  }

  /**
   * @description Approve a task
   * @param taskId - Task ID
   * @param user - Current user information
   * @param comment - Optional approval comment
   * @returns Promise with transition response
   */
  async approveTask(taskId: number, user: WorkflowUser, comment?: string): Promise<WorkflowTransitionResponse> {
    try {
      const response = await api.post<WorkflowTransitionResponse>('/workflow/approve', {
        task_id: taskId,
        comment
      }, {
        headers: {
          'X-User-Data': this.createUserDataHeader(user)
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(`Failed to approve task: ${error.response.data.detail}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to approve task: ${error.message}`);
      }
      throw new Error('Failed to approve task: Unknown error');
    }
  }

  /**
   * @description Reject a task
   * @param taskId - Task ID
   * @param user - Current user information
   * @param reason - Rejection reason
   * @param comment - Optional rejection comment
   * @returns Promise with transition response
   */
  async rejectTask(taskId: number, user: WorkflowUser, reason: string, comment?: string): Promise<WorkflowTransitionResponse> {
    try {
      const response = await api.post<WorkflowTransitionResponse>('/workflow/reject', {
        task_id: taskId,
        reason,
        comment
      }, {
        headers: {
          'X-User-Data': this.createUserDataHeader(user)
        }
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.detail) {
        throw new Error(`Failed to reject task: ${error.response.data.detail}`);
      }
      if (error instanceof Error) {
        throw new Error(`Failed to reject task: ${error.message}`);
      }
      throw new Error('Failed to reject task: Unknown error');
    }
  }

  /**
   * @description Get valid transitions for a task
   * @param taskId - Task ID
   * @returns Promise with valid transitions
   */
  async getValidTransitions(taskId: number): Promise<ValidTransitionsResponse> {
    try {
      const response = await api.get<ValidTransitionsResponse>(`/workflow/transitions/${taskId}`);
      return response.data;
    } catch (error: any) {
      // Return default transitions if API fails
      return {
        valid_transitions: ['in_progress', 'submitted_for_approval', 'done', 'cancelled']
      };
    }
  }

  /**
   * @description Get color for a task status
   * @param status - Task status
   * @returns Color string
   */
  getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      'todo': 'blue',
      'assigned': 'blue',
      'in_progress': 'yellow',
      'submitted_for_approval': 'purple',
      'review': 'orange',
      'done': 'green',
      'cancelled': 'red'
    };
    return statusColors[status] || 'gray';
  }

  /**
   * @description Get display name for a task status
   * @param status - Task status
   * @returns Display name string
   */
  getStatusDisplayName(status: string): string {
    const statusNames: Record<string, string> = {
      'todo': 'To Do',
      'assigned': 'Assigned',
      'in_progress': 'In Progress',
      'submitted_for_approval': 'Submitted for Approval',
      'review': 'Review',
      'done': 'Done',
      'cancelled': 'Cancelled'
    };
    return statusNames[status] || status;
  }
}

/**
 * @description Default workflow service instance
 */
export const workflowService = WorkflowService.getInstance();

export default workflowService;