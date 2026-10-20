/**
 * @fileoverview Workflow Statistics Service
 * @description Service for calculating and providing workflow-related statistics
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { Task } from './taskService';

// Define WorkflowStatus type since the component doesn't exist yet
export type WorkflowStatus = 'todo' | 'assigned' | 'in_progress' | 'submitted_for_approval' | 'review' | 'done' | 'cancelled';

export interface WorkflowStats {
  // Status distribution
  todo: number;
  assigned: number;
  inProgress: number;
  submittedForApproval: number;
  review: number;
  done: number;
  cancelled: number;
  
  // Workflow metrics
  totalTasks: number;
  activeWorkflow: number; // Tasks in workflow (not todo/done/cancelled)
  pendingApproval: number; // Tasks waiting for approval
  completionRate: number; // Percentage of done tasks
  
  // Time-based metrics
  overdueTasks: number;
  dueTodayTasks: number;
  dueThisWeekTasks: number;
  
  // Approval metrics
  approvalBacklog: number; // Tasks submitted but not reviewed
  rejectedTasks: number; // Tasks that were rejected (if we track this)
  
  // Priority distribution in workflow
  highPriorityInWorkflow: number;
  urgentInWorkflow: number;
  
  // Average workflow times (if we have the data)
  averageTimeToComplete: string;
  averageTimeInReview: string;
}

export interface WorkflowTrendData {
  date: string;
  completed: number;
  started: number;
  submitted: number;
  approved: number;
}

/**
 * @description Workflow Statistics Service
 */
export class WorkflowStatsService {
  private static instance: WorkflowStatsService;

  /**
   * @description Get singleton instance
   * @returns WorkflowStatsService instance
   */
  public static getInstance(): WorkflowStatsService {
    if (!WorkflowStatsService.instance) {
      WorkflowStatsService.instance = new WorkflowStatsService();
    }
    return WorkflowStatsService.instance;
  }

  /**
   * @description Calculate comprehensive workflow statistics
   * @param tasks - Array of tasks to analyze
   * @returns Workflow statistics object
   */
  calculateWorkflowStats(tasks: Task[]): WorkflowStats {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Status distribution
    const todo = tasks.filter(t => t.status === 'todo').length;
    const assigned = tasks.filter(t => t.status === 'assigned').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const submittedForApproval = tasks.filter(t => t.status === 'submitted_for_approval').length;
    const review = tasks.filter(t => t.status === 'review').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const cancelled = tasks.filter(t => t.status === 'cancelled').length;

    // Workflow metrics
    const totalTasks = tasks.length;
    const activeWorkflow = assigned + inProgress + submittedForApproval + review;
    const pendingApproval = submittedForApproval + review;
    const completionRate = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;

    // Time-based metrics
    const overdueTasks = tasks.filter(t => {
      if (t.status === 'done' || t.status === 'cancelled') return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < now;
    }).length;

    const dueTodayTasks = tasks.filter(t => {
      if (t.status === 'done' || t.status === 'cancelled') return false;
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= today && dueDate < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    }).length;

    const dueThisWeekTasks = tasks.filter(t => {
      if (t.status === 'done' || t.status === 'cancelled') return false;
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate >= today && dueDate <= oneWeekFromNow;
    }).length;

    // Approval metrics
    const approvalBacklog = submittedForApproval; // Tasks submitted but not yet reviewed
    const rejectedTasks = 0; // TODO: Track rejected tasks if we implement this

    // Priority distribution in active workflow
    const workflowTasks = tasks.filter(t => 
      ['assigned', 'in_progress', 'submitted_for_approval', 'review'].includes(t.status)
    );
    const highPriorityInWorkflow = workflowTasks.filter(t => t.priority === 'high').length;
    const urgentInWorkflow = workflowTasks.filter(t => t.priority === 'urgent').length;

    // Time calculations (simplified)
    const completedTasks = tasks.filter(t => t.status === 'done');
    const averageTimeToComplete = this.calculateAverageCompletionTime(completedTasks);
    const averageTimeInReview = this.calculateAverageReviewTime(tasks);

    return {
      todo,
      assigned,
      inProgress,
      submittedForApproval,
      review,
      done,
      cancelled,
      totalTasks,
      activeWorkflow,
      pendingApproval,
      completionRate,
      overdueTasks,
      dueTodayTasks,
      dueThisWeekTasks,
      approvalBacklog,
      rejectedTasks,
      highPriorityInWorkflow,
      urgentInWorkflow,
      averageTimeToComplete,
      averageTimeInReview
    };
  }

  /**
   * @description Calculate workflow status distribution for charts
   * @param tasks - Array of tasks to analyze
   * @returns Status distribution object
   */
  getStatusDistribution(tasks: Task[]): Record<WorkflowStatus, number> {
    const distribution: Record<WorkflowStatus, number> = {
      todo: 0,
      assigned: 0,
      in_progress: 0,
      submitted_for_approval: 0,
      review: 0,
      done: 0,
      cancelled: 0
    };

    tasks.forEach(task => {
      const status = task.status as WorkflowStatus;
      if (distribution.hasOwnProperty(status)) {
        distribution[status]++;
      }
    });

    return distribution;
  }

  /**
   * @description Get workflow efficiency metrics
   * @param tasks - Array of tasks to analyze
   * @returns Efficiency metrics
   */
  getWorkflowEfficiency(tasks: Task[]): {
    throughput: number; // Tasks completed per day (last 30 days)
    cycleTime: number; // Average days from start to completion
    leadTime: number; // Average days from creation to completion
    bottleneckStage: string; // Stage with most tasks
  } {
    const completedTasks = tasks.filter(t => t.status === 'done');
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentCompletions = completedTasks.filter(t => 
      new Date(t.updated_at) >= last30Days
    );
    
    const throughput = recentCompletions.length / 30;

    // Find bottleneck stage
    const statusCounts = this.getStatusDistribution(tasks);
    const bottleneckStage = Object.entries(statusCounts)
      .filter(([status]) => !['done', 'cancelled', 'todo'].includes(status))
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    return {
      throughput,
      cycleTime: 0, // TODO: Calculate from workflow history
      leadTime: 0, // TODO: Calculate from creation to completion
      bottleneckStage
    };
  }

  /**
   * @description Calculate average completion time
   * @param completedTasks - Array of completed tasks
   * @returns Average completion time as string
   */
  private calculateAverageCompletionTime(completedTasks: Task[]): string {
    if (completedTasks.length === 0) return 'N/A';
    
    const totalDays = completedTasks.reduce((sum, task) => {
      const created = new Date(task.created_at);
      const completed = new Date(task.updated_at);
      const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return sum + Math.max(0, days);
    }, 0);
    
    const avgDays = totalDays / completedTasks.length;
    return avgDays < 1 ? '< 1 day' : `${avgDays.toFixed(1)}d`;
  }

  /**
   * @description Calculate average review time
   * @param tasks - Array of all tasks
   * @returns Average review time as string
   */
  private calculateAverageReviewTime(tasks: Task[]): string {
    // TODO: Calculate from workflow history when available
    return 'N/A';
  }

  /**
   * @description Generate workflow trend data for charts
   * @param tasks - Array of tasks to analyze
   * @param days - Number of days to include in trend
   * @returns Array of trend data points
   */
  generateWorkflowTrends(tasks: Task[], days: number = 30): WorkflowTrendData[] {
    const trends: WorkflowTrendData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      // Count tasks that changed status on this date
      const completed = tasks.filter(t => 
        t.status === 'done' && 
        new Date(t.updated_at).toDateString() === date.toDateString()
      ).length;

      const started = tasks.filter(t => 
        t.status === 'in_progress' && 
        new Date(t.updated_at).toDateString() === date.toDateString()
      ).length;

      const submitted = tasks.filter(t => 
        t.status === 'submitted_for_approval' && 
        new Date(t.updated_at).toDateString() === date.toDateString()
      ).length;

      // For approved, we'd need workflow history
      const approved = 0;

      trends.push({
        date: dateStr,
        completed,
        started,
        submitted,
        approved
      });
    }

    return trends;
  }
}

/**
 * @description Export singleton instance
 */
export const workflowStatsService = WorkflowStatsService.getInstance();
