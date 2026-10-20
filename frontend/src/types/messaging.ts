/**
 * Messaging Type Definitions
 * 
 * Type definitions for messaging system including direct messages,
 * task chat, conversations, and real-time messaging features.
 */

import { User } from './user';
import { MediaAttachment } from './media';

export interface DirectMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender: User;
  content: string;
  media_attachments?: MediaAttachment[];
  reply_to_message_id?: number;
  reply_to_message?: DirectMessage;
  reactions?: MessageReaction[];
  is_edited: boolean;
  edited_at?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskChatMessage {
  id: number;
  task_id: number;
  sender_id: number;
  sender: User;
  content: string;
  media_attachments?: MediaAttachment[];
  reply_to_message_id?: number;
  reply_to_message?: TaskChatMessage;
  mentioned_users?: User[];
  reactions?: MessageReaction[];
  is_pinned: boolean;
  pinned_at?: string;
  pinned_by_user_id?: number;
  is_edited: boolean;
  edited_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  title?: string;
  participants: User[];
  creator_id: number;
  creator: User;
  last_message?: DirectMessage;
  unread_count: number;
  is_muted: boolean;
  muted_until?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageReaction {
  id: number;
  message_id: number;
  user_id: number;
  user: User;
  reaction: string; // emoji or reaction type
  created_at: string;
}

export interface TypingIndicator {
  user_id: number;
  user: User;
  conversation_id?: number;
  task_id?: number;
  started_at: string;
  expires_at: string;
}

export interface MessageThread {
  parent_message: DirectMessage | TaskChatMessage;
  replies: (DirectMessage | TaskChatMessage)[];
  total_replies: number;
  last_reply_at?: string;
}

export interface MessageMention {
  id: number;
  message_id: number;
  mentioned_user_id: number;
  mentioned_user: User;
  mentioned_by_user_id: number;
  mentioned_by_user: User;
  is_read: boolean;
  created_at: string;
}

export interface ConversationSettings {
  id: number;
  conversation_id: number;
  user_id: number;
  notifications_enabled: boolean;
  sound_enabled: boolean;
  desktop_notifications: boolean;
  email_notifications: boolean;
  is_archived: boolean;
  is_pinned: boolean;
  custom_ringtone?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageDraft {
  id: number;
  user_id: number;
  conversation_id?: number;
  task_id?: number;
  content: string;
  media_attachments?: number[];
  created_at: string;
  updated_at: string;
}

export interface ScheduledMessage {
  id: number;
  user_id: number;
  conversation_id?: number;
  task_id?: number;
  content: string;
  media_attachments?: MediaAttachment[];
  scheduled_at: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  sent_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: number;
  user_id: number;
  name: string;
  content: string;
  category: string;
  is_public: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface MessageSearch {
  query: string;
  conversation_id?: number;
  task_id?: number;
  message_type?: 'direct' | 'task_chat';
  date_from?: string;
  date_to?: string;
  has_media?: boolean;
  mentioned_user_id?: number;
}

export interface MessageSearchResult {
  message: DirectMessage | TaskChatMessage;
  message_type: 'direct' | 'task_chat';
  conversation?: Conversation;
  task_title?: string;
  highlight_snippet: string;
  match_score: number;
}

export interface UserStatus {
  user_id: number;
  user: User;
  status: 'online' | 'away' | 'busy' | 'offline';
  status_message?: string;
  last_seen: string;
  is_typing: boolean;
  typing_in_conversation_id?: number;
  typing_in_task_id?: number;
}

export interface MessageNotification {
  id: number;
  user_id: number;
  message_id: number;
  message_type: 'direct' | 'task_chat';
  notification_type: 'new_message' | 'mention' | 'reply' | 'reaction';
  title: string;
  body: string;
  is_read: boolean;
  is_sent: boolean;
  sent_at?: string;
  created_at: string;
}

export interface MessageStatistics {
  total_messages_sent: number;
  total_messages_received: number;
  direct_messages_count: number;
  task_chat_messages_count: number;
  average_response_time: number; // in minutes
  most_active_conversation: Conversation;
  most_active_task_chat: {
    task_id: number;
    task_title: string;
    message_count: number;
  };
  daily_activity: Array<{
    date: string;
    messages_sent: number;
    messages_received: number;
  }>;
  weekly_activity: Array<{
    week_start: string;
    messages_sent: number;
    messages_received: number;
  }>;
  monthly_activity: Array<{
    month: string;
    messages_sent: number;
    messages_received: number;
  }>;
}

export interface MessageExport {
  id: number;
  user_id: number;
  conversation_id?: number;
  task_id?: number;
  format: 'json' | 'csv' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_url?: string;
  file_size?: number;
  expires_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// WebSocket message types for real-time messaging
export type MessagingWebSocketEvent = 
  | 'direct_message_received'
  | 'direct_message_updated'
  | 'direct_message_deleted'
  | 'task_message_created'
  | 'task_message_updated'
  | 'task_message_deleted'
  | 'task_message_pinned'
  | 'task_message_unpinned'
  | 'user_typing_direct'
  | 'user_typing_task'
  | 'user_stopped_typing_direct'
  | 'user_stopped_typing_task'
  | 'user_status_changed'
  | 'message_read'
  | 'message_reaction_added'
  | 'message_reaction_removed'
  | 'conversation_created'
  | 'conversation_updated'
  | 'task_participant_joined'
  | 'task_participant_left';

export interface MessagingWebSocketMessage {
  event: MessagingWebSocketEvent;
  data: {
    message?: DirectMessage | TaskChatMessage;
    conversation?: Conversation;
    user?: User;
    task_id?: number;
    conversation_id?: number;
    message_id?: number;
    reaction?: string;
    typing_users?: User[];
    timestamp: string;
    [key: string]: any;
  };
}

// Message content types for rich content
export interface MessageContent {
  type: 'text' | 'rich_text' | 'code' | 'quote' | 'list';
  content: string;
  metadata?: {
    language?: string; // for code blocks
    author?: string; // for quotes
    list_type?: 'ordered' | 'unordered'; // for lists
    formatting?: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      strikethrough?: boolean;
    };
  };
}

// Message delivery status
export interface MessageDeliveryStatus {
  message_id: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  delivered_to?: User[];
  read_by?: Array<{
    user: User;
    read_at: string;
  }>;
  failed_recipients?: Array<{
    user: User;
    error: string;
  }>;
  updated_at: string;
}
