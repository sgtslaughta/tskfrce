/**
 * Comment Type Definitions
 * 
 * Type definitions for task comments system including threading,
 * media attachments, and user interactions.
 */

import { User } from './user';
import { MediaAttachment } from './media';

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user: User;
  content: string;
  parent_comment_id?: number;
  parent_comment?: TaskComment;
  replies?: TaskComment[];
  reply_count: number;
  media_attachments?: MediaAttachment[];
  mentioned_users?: User[];
  reactions?: CommentReaction[];
  is_system_generated: boolean;
  is_edited: boolean;
  edited_at?: string;
  is_pinned: boolean;
  pinned_at?: string;
  pinned_by_user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface CommentReaction {
  id: number;
  comment_id: number;
  user_id: number;
  user: User;
  reaction: string; // emoji or reaction type
  created_at: string;
}

export interface CommentMention {
  id: number;
  comment_id: number;
  mentioned_user_id: number;
  mentioned_user: User;
  mentioned_by_user_id: number;
  mentioned_by_user: User;
  is_read: boolean;
  created_at: string;
}

export interface CommentThread {
  parent_comment: TaskComment;
  replies: TaskComment[];
  total_replies: number;
  last_reply_at?: string;
}

export interface CommentDraft {
  id: number;
  task_id: number;
  user_id: number;
  content: string;
  parent_comment_id?: number;
  media_attachments?: number[];
  created_at: string;
  updated_at: string;
}

export interface CommentNotification {
  id: number;
  comment_id: number;
  user_id: number;
  notification_type: 'new_comment' | 'comment_reply' | 'comment_mention' | 'comment_reaction';
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface CommentSearch {
  query: string;
  task_id?: number;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  has_media?: boolean;
  is_system_generated?: boolean;
  mentioned_user_id?: number;
}

export interface CommentSearchResult {
  comment: TaskComment;
  task_title: string;
  highlight_snippet: string;
  match_score: number;
}

export interface CommentStatistics {
  total_comments: number;
  comments_by_user: Array<{
    user: User;
    comment_count: number;
  }>;
  comments_by_task: Array<{
    task_id: number;
    task_title: string;
    comment_count: number;
  }>;
  daily_activity: Array<{
    date: string;
    comment_count: number;
  }>;
  most_active_threads: Array<{
    parent_comment: TaskComment;
    reply_count: number;
  }>;
  reaction_summary: Array<{
    reaction: string;
    count: number;
  }>;
}

// WebSocket events for comments
export type CommentWebSocketEvent = 
  | 'comment_created'
  | 'comment_updated'
  | 'comment_deleted'
  | 'comment_pinned'
  | 'comment_unpinned'
  | 'comment_reaction_added'
  | 'comment_reaction_removed'
  | 'user_typing_comment';

export interface CommentWebSocketMessage {
  event: CommentWebSocketEvent;
  data: {
    comment?: TaskComment;
    task_id: number;
    user?: User;
    comment_id?: number;
    reaction?: string;
    typing_users?: User[];
    timestamp: string;
    [key: string]: any;
  };
}
