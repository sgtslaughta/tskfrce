/**
 * Messaging Components Index
 * 
 * Centralized exports for all messaging-related components.
 */

export { default as DirectMessaging } from './DirectMessaging';
export { default as TaskChatSection } from './TaskChatSection';
export { default as ReadReceiptIndicator } from './ReadReceiptIndicator';

// Re-export types for convenience
export type {
  DirectMessage,
  TaskChatMessage,
  Conversation,
  MessageReaction,
  TypingIndicator,
  MessageThread,
  MessageMention,
  ConversationSettings,
  MessageDraft,
  ScheduledMessage,
  MessageTemplate,
  MessageSearch,
  MessageSearchResult,
  UserStatus,
  MessageNotification,
  MessageStatistics,
  MessageExport,
  MessagingWebSocketEvent,
  MessagingWebSocketMessage,
  MessageContent,
  MessageDeliveryStatus
} from '../../types/messaging';

export type {
  CreateConversationRequest,
  SendDirectMessageRequest,
  SendTaskChatMessageRequest,
  UpdateMessageRequest,
  ConversationsResponse,
  ConversationMessagesResponse,
  TaskChatMessagesResponse,
  TaskChatParticipantsResponse,
  MessageResponse,
  ConversationResponse
} from '../../services/messagingService';
