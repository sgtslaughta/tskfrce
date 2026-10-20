/**
 * @fileoverview WebSocket Service for TaaskMaaster
 * @description Service for handling real-time WebSocket connections
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

/**
 * @description WebSocket message interface
 */
export interface WebSocketMessage {
  type: string;
  timestamp: string;
  data: any;
}

/**
 * @description Notification message interface
 */
export interface NotificationMessage extends WebSocketMessage {
  notification_type: string;
  title?: string;
  message: string;
  action_url?: string;
}

/**
 * @description Messaging WebSocket message interface
 */
export interface MessagingWebSocketMessage extends WebSocketMessage {
  message_type: string;
  sender: {
    id: number;
    username: string;
  };
  content?: string;
  context?: any;
}

/**
 * @description WebSocket connection status
 */
export enum WebSocketStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * @description WebSocket event handlers
 */
export interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onNotification?: (notification: NotificationMessage) => void;
  onDirectMessage?: (message: MessagingWebSocketMessage) => void;
  onTaskChatMessage?: (message: MessagingWebSocketMessage) => void;
  onTypingIndicator?: (data: any) => void;
  onUserStatusChanged?: (data: any) => void;
}

/**
 * @description WebSocket Service Class
 * @class WebSocketService
 */
export class WebSocketService {
  private notificationSocket: WebSocket | null = null;
  private messagingSocket: WebSocket | null = null;
  private notificationStatus: WebSocketStatus = WebSocketStatus.DISCONNECTED;
  private messagingStatus: WebSocketStatus = WebSocketStatus.DISCONNECTED;
  private eventHandlers: WebSocketEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // Start with 1 second
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private userData: any = null;

  /**
   * Initialize WebSocket service with user data
   * @param userData - User data for authentication
   */
  initialize(userData: any) {
    this.userData = userData;
  }

  /**
   * Set event handlers
   * @param handlers - WebSocket event handlers
   */
  setEventHandlers(handlers: WebSocketEventHandlers) {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Connect to notifications WebSocket
   */
  connectNotifications(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.notificationStatus === WebSocketStatus.CONNECTED) {
        resolve();
        return;
      }

      if (!this.userData) {
        reject(new Error('User data not initialized'));
        return;
      }

      this.notificationStatus = WebSocketStatus.CONNECTING;
      
      const wsUrl = `ws://localhost:8000/ws/notifications?user_data=${encodeURIComponent(
        JSON.stringify(this.userData)
      )}`;

      this.notificationSocket = new WebSocket(wsUrl);

      this.notificationSocket.onopen = () => {
        console.log('Notifications WebSocket connected');
        this.notificationStatus = WebSocketStatus.CONNECTED;
        this.reconnectAttempts = 0;
        this.startHeartbeat('notifications');
        this.eventHandlers.onConnect?.();
        resolve();
      };

      this.notificationSocket.onclose = (event) => {
        console.log('Notifications WebSocket disconnected:', event.code, event.reason);
        this.notificationStatus = WebSocketStatus.DISCONNECTED;
        this.stopHeartbeat();
        this.eventHandlers.onDisconnect?.();
        
        // Attempt to reconnect if not a clean closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect('notifications');
        }
      };

      this.notificationSocket.onerror = (error) => {
        console.error('Notifications WebSocket error:', error);
        this.notificationStatus = WebSocketStatus.ERROR;
        this.eventHandlers.onError?.(error);
        reject(error);
      };

      this.notificationSocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleNotificationMessage(message);
        } catch (error) {
          console.error('Error parsing notification message:', error);
        }
      };
    });
  }

  /**
   * Connect to messaging WebSocket
   */
  connectMessaging(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.messagingStatus === WebSocketStatus.CONNECTED) {
        resolve();
        return;
      }

      if (!this.userData) {
        reject(new Error('User data not initialized'));
        return;
      }

      this.messagingStatus = WebSocketStatus.CONNECTING;
      
      const wsUrl = `ws://localhost:8000/ws/messaging?user_data=${encodeURIComponent(
        JSON.stringify(this.userData)
      )}`;

      this.messagingSocket = new WebSocket(wsUrl);

      this.messagingSocket.onopen = () => {
        console.log('Messaging WebSocket connected');
        this.messagingStatus = WebSocketStatus.CONNECTED;
        this.reconnectAttempts = 0;
        this.startHeartbeat('messaging');
        this.eventHandlers.onConnect?.();
        resolve();
      };

      this.messagingSocket.onclose = (event) => {
        console.log('Messaging WebSocket disconnected:', event.code, event.reason);
        this.messagingStatus = WebSocketStatus.DISCONNECTED;
        this.stopHeartbeat();
        this.eventHandlers.onDisconnect?.();
        
        // Attempt to reconnect if not a clean closure
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect('messaging');
        }
      };

      this.messagingSocket.onerror = (error) => {
        console.error('Messaging WebSocket error:', error);
        this.messagingStatus = WebSocketStatus.ERROR;
        this.eventHandlers.onError?.(error);
        reject(error);
      };

      this.messagingSocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessagingMessage(message);
        } catch (error) {
          console.error('Error parsing messaging message:', error);
        }
      };
    });
  }

  /**
   * Disconnect from notifications WebSocket
   */
  disconnectNotifications() {
    if (this.notificationSocket) {
      this.notificationStatus = WebSocketStatus.DISCONNECTING;
      this.notificationSocket.close(1000, 'Client disconnect');
      this.notificationSocket = null;
    }
  }

  /**
   * Disconnect from messaging WebSocket
   */
  disconnectMessaging() {
    if (this.messagingSocket) {
      this.messagingStatus = WebSocketStatus.DISCONNECTING;
      this.messagingSocket.close(1000, 'Client disconnect');
      this.messagingSocket = null;
    }
  }

  /**
   * Disconnect all WebSocket connections
   */
  disconnectAll() {
    this.disconnectNotifications();
    this.disconnectMessaging();
    this.stopHeartbeat();
  }

  /**
   * Send typing indicator
   * @param contextType - Context type (task_chat, direct_message)
   * @param contextId - Context ID
   * @param isTyping - Whether user is typing
   */
  sendTypingIndicator(contextType: string, contextId: number, isTyping: boolean) {
    if (this.messagingSocket && this.messagingStatus === WebSocketStatus.CONNECTED) {
      const message = {
        type: 'typing_indicator',
        context_type: contextType,
        context_id: contextId,
        is_typing: isTyping,
        timestamp: new Date().toISOString(),
      };
      
      this.messagingSocket.send(JSON.stringify(message));
    }
  }

  /**
   * Update user status
   * @param status - User status (online, away, busy, offline)
   */
  updateStatus(status: string) {
    const message = {
      type: 'status_update',
      status: status,
      timestamp: new Date().toISOString(),
    };

    // Send to both connections if available
    if (this.notificationSocket && this.notificationStatus === WebSocketStatus.CONNECTED) {
      this.notificationSocket.send(JSON.stringify(message));
    }
    
    if (this.messagingSocket && this.messagingStatus === WebSocketStatus.CONNECTED) {
      this.messagingSocket.send(JSON.stringify(message));
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      notifications: this.notificationStatus,
      messaging: this.messagingStatus,
    };
  }

  /**
   * Handle notification messages
   * @private
   */
  private handleNotificationMessage(message: WebSocketMessage) {
    this.eventHandlers.onMessage?.(message);

    switch (message.type) {
      case 'task_comment':
      case 'task_status_changed':
      case 'task_approval_request':
      case 'task_approved':
      case 'task_rejected':
      case 'user_mentioned':
      case 'media_attached':
        this.eventHandlers.onNotification?.(message as NotificationMessage);
        break;
      case 'heartbeat_ack':
        // Handle heartbeat acknowledgment
        break;
      default:
        console.warn('Unknown notification message type:', message.type);
    }
  }

  /**
   * Handle messaging messages
   * @private
   */
  private handleMessagingMessage(message: WebSocketMessage) {
    this.eventHandlers.onMessage?.(message);

    switch (message.type) {
      case 'direct_message':
        this.eventHandlers.onDirectMessage?.(message as MessagingWebSocketMessage);
        break;
      case 'task_chat_message':
        this.eventHandlers.onTaskChatMessage?.(message as MessagingWebSocketMessage);
        break;
      case 'typing_indicator':
        this.eventHandlers.onTypingIndicator?.(message.data);
        break;
      case 'user_status_changed':
        this.eventHandlers.onUserStatusChanged?.(message.data);
        break;
      case 'heartbeat_ack':
        // Handle heartbeat acknowledgment
        break;
      default:
        console.warn('Unknown messaging message type:', message.type);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   * @private
   */
  private startHeartbeat(type: 'notifications' | 'messaging') {
    this.heartbeatInterval = setInterval(() => {
      const message = {
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
      };

      if (type === 'notifications' && this.notificationSocket) {
        this.notificationSocket.send(JSON.stringify(message));
      } else if (type === 'messaging' && this.messagingSocket) {
        this.messagingSocket.send(JSON.stringify(message));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat
   * @private
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect WebSocket
   * @private
   */
  private attemptReconnect(type: 'notifications' | 'messaging') {
    this.reconnectAttempts++;
    
    const delay = Math.min(this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`Attempting to reconnect ${type} WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (type === 'notifications') {
        this.connectNotifications().catch(console.error);
      } else {
        this.connectMessaging().catch(console.error);
      }
    }, delay);
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
