/**
 * Messaging Service
 * 
 * Handles all messaging-related API calls including direct messages,
 * task chat, conversations, and real-time messaging features.
 */

import { apiClient } from './apiClient';
import { DirectMessage, TaskChatMessage, Conversation, MessageDeliveryStatus } from '../types/messaging';
import { User } from '../types/user';

export interface CreateConversationRequest {
  participant_ids: number[];
  type: 'direct' | 'group';
  title?: string;
}

export interface SendDirectMessageRequest {
  conversation_id: number;
  content: string;
  media_attachments?: number[];
  reply_to_message_id?: number;
}

export interface SendTaskChatMessageRequest {
  task_id: number;
  content: string;
  media_attachments?: number[];
  reply_to_message_id?: number;
  mentioned_user_ids?: number[];
}

export interface UpdateMessageRequest {
  content: string;
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total_count: number;
}

export interface ConversationMessagesResponse {
  messages: DirectMessage[];
  total_count: number;
  has_more: boolean;
}

export interface TaskChatMessagesResponse {
  messages: TaskChatMessage[];
  total_count: number;
  has_more: boolean;
}

export interface TaskChatParticipantsResponse {
  participants: User[];
  total_count: number;
}

export interface MessageResponse {
  message: DirectMessage | TaskChatMessage;
  success: boolean;
}

export interface ConversationResponse {
  conversation: Conversation;
  success: boolean;
}

class MessagingService {
  /**
   * Get user's conversations
   */
  async getConversations(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    type?: 'direct' | 'group';
  }): Promise<ConversationsResponse> {
    const response = await apiClient.get('/messages/conversations', { params });
    return response.data;
  }

  /**
   * Create a new conversation
   */
  async createConversation(request: CreateConversationRequest): Promise<ConversationResponse> {
    const response = await apiClient.post('/messages/conversations', request);
    return response.data;
  }

  /**
   * Get messages for a specific conversation
   */
  async getConversationMessages(
    conversationId: number,
    params?: {
      limit?: number;
      offset?: number;
      before_message_id?: number;
      after_message_id?: number;
    }
  ): Promise<ConversationMessagesResponse> {
    const response = await apiClient.get(
      `/messages/conversations/${conversationId}/messages`,
      { params }
    );
    return response.data;
  }

  /**
   * Send a direct message
   */
  async sendDirectMessage(request: SendDirectMessageRequest): Promise<MessageResponse> {
    const response = await apiClient.post('/messages/direct', request);
    return response.data;
  }

  /**
   * Update a direct message
   */
  async updateDirectMessage(messageId: number, request: UpdateMessageRequest): Promise<MessageResponse> {
    const response = await apiClient.put(`/messages/direct/${messageId}`, request);
    return response.data;
  }

  /**
   * Delete a direct message
   */
  async deleteDirectMessage(messageId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/messages/direct/${messageId}`);
    return response.data;
  }

  /**
   * Mark conversation as read
   */
  async markConversationAsRead(conversationId: number): Promise<{ success: boolean }> {
    const response = await apiClient.post(`/messages/conversations/${conversationId}/read`);
    return response.data;
  }

  /**
   * Get task chat messages
   */
  async getTaskChatMessages(
    taskId: number,
    params?: {
      limit?: number;
      offset?: number;
      include_media?: boolean;
      include_mentions?: boolean;
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
    }
  ): Promise<TaskChatMessagesResponse> {
    const response = await apiClient.get(`/messages/task-chat/${taskId}`, { params });
    return response.data;
  }

  /**
   * Send a task chat message
   */
  async sendTaskChatMessage(request: SendTaskChatMessageRequest): Promise<MessageResponse> {
    const response = await apiClient.post('/messages/task-chat', request);
    return response.data;
  }

  /**
   * Update a task chat message
   */
  async updateTaskChatMessage(messageId: number, request: UpdateMessageRequest): Promise<MessageResponse> {
    const response = await apiClient.put(`/messages/task-chat/${messageId}`, request);
    return response.data;
  }

  /**
   * Delete a task chat message
   */
  async deleteTaskChatMessage(messageId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/messages/task-chat/${messageId}`);
    return response.data;
  }

  /**
   * Pin a task chat message
   */
  async pinTaskChatMessage(messageId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`/messages/task-chat/${messageId}/pin`);
    return response.data;
  }

  /**
   * Unpin a task chat message
   */
  async unpinTaskChatMessage(messageId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/messages/task-chat/${messageId}/pin`);
    return response.data;
  }

  /**
   * Get task chat participants
   */
  async getTaskChatParticipants(taskId: number): Promise<TaskChatParticipantsResponse> {
    const response = await apiClient.get(`/messages/task-chat/${taskId}/participants`);
    return response.data;
  }

  /**
   * Add participant to task chat
   */
  async addTaskChatParticipant(taskId: number, userId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`/messages/task-chat/${taskId}/participants`, {
      user_id: userId
    });
    return response.data;
  }

  /**
   * Remove participant from task chat
   */
  async removeTaskChatParticipant(taskId: number, userId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/messages/task-chat/${taskId}/participants/${userId}`);
    return response.data;
  }

  /**
   * Search messages
   */
  async searchMessages(params: {
    query: string;
    conversation_id?: number;
    task_id?: number;
    message_type?: 'direct' | 'task_chat';
    limit?: number;
    offset?: number;
  }): Promise<{
    direct_messages: DirectMessage[];
    task_chat_messages: TaskChatMessage[];
    total_count: number;
  }> {
    const response = await apiClient.get('/messages/search', { params });
    return response.data;
  }

  /**
   * Get message thread/replies
   */
  async getMessageThread(messageId: number, messageType: 'direct' | 'task_chat'): Promise<{
    parent_message: DirectMessage | TaskChatMessage;
    replies: (DirectMessage | TaskChatMessage)[];
  }> {
    const response = await apiClient.get(`/messages/${messageType}/${messageId}/thread`);
    return response.data;
  }

  /**
   * React to a message
   */
  async reactToMessage(
    messageId: number,
    messageType: 'direct' | 'task_chat',
    reaction: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`/messages/${messageType}/${messageId}/react`, {
      reaction
    });
    return response.data;
  }

  /**
   * Remove reaction from message
   */
  async removeMessageReaction(
    messageId: number,
    messageType: 'direct' | 'task_chat',
    reaction: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(
      `/messages/${messageType}/${messageId}/react/${reaction}`
    );
    return response.data;
  }

  /**
   * Get user's message statistics
   */
  async getMessageStats(params?: {
    date_from?: string;
    date_to?: string;
    conversation_id?: number;
    task_id?: number;
  }): Promise<{
    total_messages_sent: number;
    total_messages_received: number;
    direct_messages_count: number;
    task_chat_messages_count: number;
    most_active_conversations: Array<{
      conversation: Conversation;
      message_count: number;
    }>;
    daily_activity: Array<{
      date: string;
      messages_sent: number;
      messages_received: number;
    }>;
  }> {
    const response = await apiClient.get('/messages/stats', { params });
    return response.data;
  }

  /**
   * Export conversation/chat history
   */
  async exportMessages(params: {
    conversation_id?: number;
    task_id?: number;
    format: 'json' | 'csv' | 'pdf';
    date_from?: string;
    date_to?: string;
  }): Promise<{ download_url: string; expires_at: string }> {
    const response = await apiClient.post('/messages/export', params);
    return response.data;
  }

  /**
   * Get typing indicators for conversation
   */
  async getTypingUsers(conversationId: number): Promise<{ typing_users: User[] }> {
    const response = await apiClient.get(`/messages/conversations/${conversationId}/typing`);
    return response.data;
  }

  /**
   * Get typing indicators for task chat
   */
  async getTaskChatTypingUsers(taskId: number): Promise<{ typing_users: User[] }> {
    const response = await apiClient.get(`/messages/task-chat/${taskId}/typing`);
    return response.data;
  }

  /**
   * Update user's online status
   */
  async updateOnlineStatus(isOnline: boolean): Promise<{ success: boolean }> {
    const response = await apiClient.post('/messages/status', {
      is_online: isOnline
    });
    return response.data;
  }

  /**
   * Get online users
   */
  async getOnlineUsers(): Promise<{ online_users: User[] }> {
    const response = await apiClient.get('/messages/online-users');
    return response.data;
  }

  /**
   * Bulk operations
   */
  async bulkDeleteMessages(messageIds: number[], messageType: 'direct' | 'task_chat'): Promise<{
    success: boolean;
    deleted_count: number;
    failed_count: number;
    errors: string[];
  }> {
    const response = await apiClient.post('/messages/bulk-delete', {
      message_ids: messageIds,
      message_type: messageType
    });
    return response.data;
  }

  async bulkMarkAsRead(conversationIds: number[]): Promise<{
    success: boolean;
    marked_count: number;
    failed_count: number;
    errors: string[];
  }> {
    const response = await apiClient.post('/messages/bulk-mark-read', {
      conversation_ids: conversationIds
    });
    return response.data;
  }

  /**
   * Message templates
   */
  async getMessageTemplates(): Promise<{
    templates: Array<{
      id: number;
      name: string;
      content: string;
      category: string;
      is_public: boolean;
    }>;
  }> {
    const response = await apiClient.get('/messages/templates');
    return response.data;
  }

  async createMessageTemplate(template: {
    name: string;
    content: string;
    category: string;
    is_public?: boolean;
  }): Promise<{ success: boolean; template_id: number }> {
    const response = await apiClient.post('/messages/templates', template);
    return response.data;
  }

  /**
   * Message scheduling
   */
  async scheduleMessage(params: {
    conversation_id?: number;
    task_id?: number;
    content: string;
    scheduled_at: string;
    media_attachments?: number[];
  }): Promise<{
    success: boolean;
    scheduled_message_id: number;
  }> {
    const response = await apiClient.post('/messages/schedule', params);
    return response.data;
  }

  async cancelScheduledMessage(scheduledMessageId: number): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/messages/scheduled/${scheduledMessageId}`);
    return response.data;
  }

  async getScheduledMessages(): Promise<{
    scheduled_messages: Array<{
      id: number;
      content: string;
      scheduled_at: string;
      conversation_id?: number;
      task_id?: number;
      status: 'pending' | 'sent' | 'cancelled';
    }>;
  }> {
    const response = await apiClient.get('/messages/scheduled');
    return response.data;
  }

  /**
   * Read receipts and message status
   */
  async markMessageAsRead(messageId: number, messageType: 'direct' | 'task_chat'): Promise<{ success: boolean }> {
    const response = await apiClient.post('/messages/mark-read', {
      message_id: messageId,
      message_type: messageType
    });
    return response.data;
  }

  async getMessageDeliveryStatus(messageId: number): Promise<MessageDeliveryStatus> {
    const response = await apiClient.get(`/messages/${messageId}/delivery-status`);
    return response.data;
  }

  async markMultipleMessagesAsRead(messageIds: number[], messageType: 'direct' | 'task_chat'): Promise<{ 
    success: boolean;
    marked_count: number;
  }> {
    const response = await apiClient.post('/messages/mark-multiple-read', {
      message_ids: messageIds,
      message_type: messageType
    });
    return response.data;
  }

  async getUnreadMessageCount(conversationId?: number, taskId?: number): Promise<{
    unread_count: number;
    last_read_message_id?: number;
  }> {
    const params: any = {};
    if (conversationId) params.conversation_id = conversationId;
    if (taskId) params.task_id = taskId;
    
    const response = await apiClient.get('/messages/unread-count', { params });
    return response.data;
  }

  /**
   * Message delivery tracking
   */
  async getMessageReadReceipts(messageId: number): Promise<{
    read_by: Array<{
      user: User;
      read_at: string;
    }>;
    delivered_to: User[];
    total_recipients: number;
  }> {
    const response = await apiClient.get(`/messages/${messageId}/read-receipts`);
    return response.data;
  }

  /**
   * Advanced search functionality
   */
  async searchDirectMessages(params: {
    query?: string;
    conversation_id?: number;
    user_ids?: number[];
    content_types?: string[];
    has_attachments?: boolean;
    has_reactions?: boolean;
    is_edited?: boolean;
    tags?: string[];
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    per_page?: number;
    include_read_receipts?: boolean;
  }): Promise<{
    messages: DirectMessage[];
    total: number;
    page: number;
    per_page: number;
    has_more: boolean;
  }> {
    const response = await apiClient.get('/messages/direct/search', { params });
    return response.data;
  }

  async searchTaskChatMessages(params: {
    query?: string;
    task_id?: number;
    user_ids?: number[];
    content_types?: string[];
    has_attachments?: boolean;
    has_reactions?: boolean;
    is_edited?: boolean;
    tags?: string[];
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    per_page?: number;
    include_mentions?: boolean;
  }): Promise<{
    messages: TaskChatMessage[];
    total: number;
    page: number;
    per_page: number;
    has_more: boolean;
  }> {
    const response = await apiClient.get('/messages/task-chat/search', { params });
    return response.data;
  }

  async searchAllMessages(params: {
    query?: string;
    user_ids?: number[];
    content_types?: string[];
    has_attachments?: boolean;
    has_reactions?: boolean;
    is_edited?: boolean;
    tags?: string[];
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    per_page?: number;
  }): Promise<{
    direct_messages: DirectMessage[];
    task_chat_messages: TaskChatMessage[];
    total: number;
    page: number;
    per_page: number;
    has_more: boolean;
  }> {
    const response = await apiClient.get('/messages/search', { params });
    return response.data;
  }
}

export const messagingService = new MessagingService();