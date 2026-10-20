/**
 * @fileoverview Comment Service for TaaskMaaster
 * @description Service for managing task comments with real-time functionality
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { apiGet, apiPost, apiPut, apiDelete } from './api';
import { getLoginState } from '../utils/cookies';

export interface Comment {
  id: number;
  task_id: number;
  user_id: number;
  content: string;
  content_type: 'text' | 'markdown' | 'html';
  parent_comment_id?: number;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    username: string;
    full_name?: string;
    avatar_url?: string;
  };
  media_attachments?: any[];
  replies?: Comment[];
  is_edited: boolean;
  edit_count: number;
}

export interface CommentCreate {
  task_id: number;
  content: string;
  content_type?: 'text' | 'markdown' | 'html';
  parent_comment_id?: number;
  media_attachment_ids?: number[];
}

export interface CommentUpdate {
  content: string;
  content_type?: 'text' | 'markdown' | 'html';
  edit_reason?: string;
}

export interface CommentListResponse {
  comments: Comment[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * @description Comment service class
 */
class CommentService {
  /**
   * @description Get comments for a specific task
   */
  async getTaskComments(
    taskId: number,
    params?: {
      skip?: number;
      limit?: number;
      include_system?: boolean;
    }
  ): Promise<CommentListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.include_system !== undefined) {
      queryParams.append('include_system', params.include_system.toString());
    }

    const url = `/comments/task/${taskId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    
    // Add user data header
    const userDataHeader = this.getUserDataHeader();
    const response = await apiGet<CommentListResponse>(url, {
      headers: userDataHeader
    });
    
    return response.data;
  }

  /**
   * @description Create a new comment
   */
  async createComment(commentData: CommentCreate): Promise<Comment> {
    const userDataHeader = this.getUserDataHeader();
    const response = await apiPost<Comment>('/comments/', commentData, {
      headers: userDataHeader
    });
    
    return response.data;
  }

  /**
   * @description Update an existing comment
   */
  async updateComment(commentId: number, updateData: CommentUpdate): Promise<Comment> {
    const userDataHeader = this.getUserDataHeader();
    const response = await apiPut<Comment>(`/comments/${commentId}`, updateData, {
      headers: userDataHeader
    });
    
    return response.data;
  }

  /**
   * @description Delete a comment
   */
  async deleteComment(commentId: number): Promise<void> {
    const userDataHeader = this.getUserDataHeader();
    await apiDelete(`/comments/${commentId}`, {
      headers: userDataHeader
    });
  }

  /**
   * @description Get a specific comment by ID
   */
  async getComment(commentId: number): Promise<Comment> {
    const userDataHeader = this.getUserDataHeader();
    const response = await apiGet<Comment>(`/comments/${commentId}`, {
      headers: userDataHeader
    });
    
    return response.data;
  }

  /**
   * @description Search task comments
   */
  async searchTaskComments(params: {
    taskId: number;
    query: string;
    skip?: number;
    limit?: number;
  }): Promise<CommentListResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('query', params.query);
    if (params.skip) queryParams.append('skip', params.skip.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const url = `/comments/search/${params.taskId}?${queryParams.toString()}`;
    
    const userDataHeader = this.getUserDataHeader();
    const response = await apiGet<CommentListResponse>(url, {
      headers: userDataHeader
    });
    
    return response.data;
  }

  /**
   * @description Get user data header for API requests
   * This matches the backend's expected X-User-Data header format
   */
  private getUserDataHeader(): Record<string, string> {
    // Get current user from cookies (same as AuthContext uses)
    const loginState = getLoginState();
    if (!loginState) {
      throw new Error('User not authenticated');
    }

    const userDataHeader = {
      'X-User-Data': JSON.stringify({
        user_id: parseInt(loginState.userId),
        username: loginState.username,
        role: 'user' // We'll get this from the user context later
      })
    };
    
    return userDataHeader;
  }
}

// Export singleton instance
export const commentService = new CommentService();
export default commentService;