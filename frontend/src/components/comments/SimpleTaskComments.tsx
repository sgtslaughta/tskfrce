/**
 * SimpleTaskComments Component
 * 
 * A simplified task comments interface using the TaaskMaaster design system
 * instead of Material-UI. Provides basic commenting functionality with
 * real-time updates and a clean chat-like interface.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '../../design-system/components/Button';
import { Input } from '../../design-system/components/Input';
import { Card } from '../../design-system/components/Card';
import { cn } from '../../design-system/utils/cn';
import { User } from '../../types/user';
import { 
  PaperAirplaneIcon,
  PaperClipIcon,
  FaceSmileIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { format, formatDistanceToNow } from 'date-fns';
import { commentService, Comment } from '../../services/commentService';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getLoginState } from '../../utils/cookies';

// Comment interface is now imported from commentService

interface SimpleTaskCommentsProps {
  taskId: number;
  currentUser: User;
  maxHeight?: number;
  allowRichText?: boolean;
  allowMediaUpload?: boolean;
  showTypingIndicators?: boolean;
  autoScrollToBottom?: boolean;
}

const SimpleTaskComments: React.FC<SimpleTaskCommentsProps> = ({
  taskId,
  currentUser,
  maxHeight = 300,
  allowRichText = true,
  allowMediaUpload = true,
  showTypingIndicators = true,
  autoScrollToBottom = true
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef<boolean>(false);
  const lastTypingSentRef = useRef<number>(0);
  const typingDisplayTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // WebSocket for notifications (comment updates)
  const notificationWS = useWebSocket({
    url: 'ws://localhost:8000/ws/notifications',
    autoConnect: false // Don't auto-connect, we'll connect manually when ready
  });

  // WebSocket for messaging (typing indicators)
  const messagingWS = useWebSocket({
    url: 'ws://localhost:8000/ws/messaging',
    autoConnect: false // Don't auto-connect, we'll connect manually when ready
  });





  // Scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (autoScrollToBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScrollToBottom]);

  // Load comments and initialize WebSocket connections when ready
  useEffect(() => {
    const loadComments = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await commentService.getTaskComments(taskId, {
          limit: 100,
          include_system: false
        });
        
        setComments(response.comments);
      } catch (err: any) {
        console.error('Failed to load comments:', err);
        setError(err.detail || 'Failed to load comments');
      } finally {
        setLoading(false);
      }
    };

    const initializeComponent = async () => {
      // First, load comments
      await loadComments();

      // Then, connect WebSockets after ensuring user is authenticated and backend is ready
      const connectWebSockets = async () => {
        // Wait a bit to ensure the backend is fully ready
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Check if user is still authenticated before connecting
        const loginState = getLoginState();
        if (loginState && loginState.userId) {
          console.log('Connecting WebSockets for authenticated user:', loginState.username);
          try {
            notificationWS.connect();
            messagingWS.connect();
          } catch (error) {
            console.error('Failed to connect WebSockets:', error);
          }
        } else {
          console.warn('User not authenticated, skipping WebSocket connection');
        }
      };
      
      connectWebSockets();
    };

    if (taskId) {
      initializeComponent();
    }

    // Cleanup function
    return () => {
      // Disconnect WebSockets when component unmounts or taskId changes
      notificationWS.disconnect();
      messagingWS.disconnect();
    };
  }, [taskId, messagingWS, notificationWS]);

  // Periodic comment polling for synchronization
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await commentService.getTaskComments(taskId, {
          limit: 100,
          include_system: false
        });
        
        // Update comments, avoiding duplicates
        setComments(prev => {
          // Create a map of existing comment IDs for deduplication
          const existingIds = new Set(prev.map(comment => comment.id));
          const newComments = response.comments.filter(comment => !existingIds.has(comment.id));
          
          // Only update if there are new comments
          if (newComments.length > 0) {
            return [...prev, ...newComments];
          }
          
          return prev;
        });
      } catch (err) {
        console.warn('Failed to poll comments:', err);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [taskId]);

  // Scroll to bottom when comments change
  useEffect(() => {
    scrollToBottom();
  }, [comments, scrollToBottom]);

  // Subscribe to real-time comment updates (notifications WebSocket)
  useEffect(() => {
    if (!notificationWS.subscribe) return;

    const unsubscribeNewComment = notificationWS.subscribe('task_comment', (data: any) => {
      // The backend sends the full notification structure, extract comment data
      if (data.task_id === taskId) {
        // Clear typing indicator for the user who just sent a message
        if (data.user?.username) {
          const username = data.user.username;
          // Clear any pending timeout for this user
          const existingTimeout = typingDisplayTimeouts.current.get(username);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
            typingDisplayTimeouts.current.delete(username);
          }
          // Immediately remove from typing users since they just sent a message
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(username);
            return newSet;
          });
        }

        // Reload comments when we get a notification for this task
        const loadComments = async () => {
          try {
            const response = await commentService.getTaskComments(taskId, {
              limit: 100,
              include_system: false
            });
            setComments(response.comments);
          } catch (err) {
            console.error('Failed to reload comments after notification:', err);
          }
        };
        loadComments();
      }
    });

    return () => {
      unsubscribeNewComment();
    };
  }, [taskId, notificationWS]);

  // Subscribe to typing indicators (messaging WebSocket)
  useEffect(() => {
    if (!messagingWS.subscribe) return;

    // Capture the ref value at the beginning of the effect
    const timeoutsRef = typingDisplayTimeouts.current;

    const unsubscribeTyping = messagingWS.subscribe('typing_indicator', (data: any) => {
      // Check if this typing indicator is for the current task
      if (data.context?.type === 'task_chat' && data.context?.context_id === taskId) {
        const username = data.user?.username;
        if (username && username !== currentUser.username) {
          if (data.is_typing) {
            // Clear any pending removal timeout for this user
            const existingTimeout = timeoutsRef.get(username);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
              timeoutsRef.delete(username);
            }
            
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.add(username);
              return newSet;
            });
          } else {
            // Don't remove immediately - enforce minimum display time of 2 seconds
            const existingTimeout = timeoutsRef.get(username);
            if (!existingTimeout) {
              const timeout = setTimeout(() => {
                setTypingUsers(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(username);
                  return newSet;
                });
                timeoutsRef.delete(username);
              }, 2000); // Minimum 2 second display time
              
              timeoutsRef.set(username, timeout);
            }
          }
        }
      }
    });

    return () => {
      unsubscribeTyping();
      // Clean up any pending typing display timeouts
      timeoutsRef.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.clear();
    };
  }, [taskId, currentUser.username, messagingWS]);

  // Send typing indicator with proper debouncing
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!messagingWS.sendMessage) {
      return;
    }

    const now = Date.now();
    const timeSinceLastSent = now - lastTypingSentRef.current;
    const previousState = isTypingRef.current;
    const statusChanged = previousState !== isTyping;
    
    // Only send if:
    // 1. Status actually changed (start/stop), OR
    // 2. It's been more than 3 seconds since last "start typing" (heartbeat)
    const shouldSend = statusChanged || 
                      (isTyping && timeSinceLastSent >= 3000);

    if (shouldSend) {
      const message = {
        type: 'typing_indicator',
        context_type: 'task_chat',
        context_id: taskId,
        is_typing: isTyping,
        data: { is_typing: isTyping }
      };
      
      messagingWS.sendMessage(message);
      isTypingRef.current = isTyping;
      lastTypingSentRef.current = now;
      

    }
  }, [messagingWS, taskId]);



  // Handle input change with typing indicators
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);

    if (sending) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.trim()) {
      // Send typing indicator when user starts typing (debounced internally)
      sendTypingIndicator(true);
      
      // Set timeout to stop typing indicator after 4 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(false);
      }, 4000);
    } else {
      // Stop typing indicator immediately when input is empty
      sendTypingIndicator(false);
    }
  }, [sending, sendTypingIndicator]);

  // Add emoji to comment
  const addEmoji = useCallback((emoji: string) => {
    setNewComment(prev => prev + emoji);
    setShowEmojiPicker(false);
    // Focus back to textarea
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle file attachment
  const handleFileAttach = useCallback(() => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';
    input.multiple = false;
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // For now, just show the filename in the comment
        // TODO: Implement actual file upload to MinIO
        setNewComment(prev => prev + `[File: ${file.name}]`);
      }
    };
    
    input.click();
    setShowAttachMenu(false);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.emoji-picker') && !target.closest('.emoji-button')) {
        setShowEmojiPicker(false);
      }
      if (!target.closest('.attach-menu') && !target.closest('.attach-button')) {
        setShowAttachMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Send stop typing indicator when component unmounts
      sendTypingIndicator(false);
    };
  }, [sendTypingIndicator, messagingWS]);

  const handleSendComment = async () => {
    if (!newComment.trim() || sending) return;

    try {
      setSending(true);
      setError(null);
      
      // Stop typing indicator when sending
      sendTypingIndicator(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      const commentData = {
        task_id: taskId,
        content: newComment,
        content_type: 'text' as const,
        parent_comment_id: replyingTo || undefined
      };
      
      const createdComment = await commentService.createComment(commentData);
      
      // Always add comment to local state for immediate feedback
      // WebSocket deduplication will handle any duplicates if they occur
      setComments(prev => {
        // Check if comment already exists to prevent duplicates
        const exists = prev.some(comment => comment.id === createdComment.id);
        if (exists) return prev;
        return [...prev, createdComment];
      });
      
      setNewComment('');
      setReplyingTo(null);
      
      // Focus back on input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err: any) {
      console.error('Failed to send comment:', err);
      setError(err.detail || 'Failed to send comment');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const isOwnComment = comment.user.id === currentUser.id;
    
    return (
      <div
        key={comment.id}
        className={cn(
          "flex gap-2 sm:gap-3 mb-3 sm:mb-4",
          isReply && "ml-4 sm:ml-8",
          isOwnComment ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-medium">
            {comment.user.username.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Message Content */}
        <div className={cn(
          "flex-1 max-w-xs sm:max-w-sm md:max-w-md",
          isOwnComment && "text-right"
        )}>
          <div className={cn(
            "rounded-lg px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm",
            isOwnComment 
              ? "bg-blue-500 text-white" 
              : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
          )}>
            {!isOwnComment && (
              <div className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
                {comment.user.username}
              </div>
            )}
            <div>{comment.content}</div>
          </div>
          
          {/* Timestamp */}
          <div className={cn(
            "text-xs text-gray-500 mt-1",
            isOwnComment ? "text-right" : "text-left"
          )}>
            {formatMessageTime(comment.created_at)}
          </div>

          {/* Action buttons */}
          <div className={cn(
            "flex gap-2 mt-1",
            isOwnComment ? "justify-end" : "justify-start"
          )}>
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="text-xs text-gray-500 hover:text-blue-500"
            >
              Reply
            </button>
            {isOwnComment && (
              <>
                <button
                  onClick={() => setEditingComment(comment.id)}
                  className="text-xs text-gray-500 hover:text-blue-500"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-xs text-gray-500 hover:text-red-500"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await commentService.deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err: any) {
      console.error('Failed to delete comment:', err);
      setError(err.detail || 'Failed to delete comment');
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="animate-pulse">Loading comments...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Discussion ({comments.length})
          </h3>
          {/* Connection status indicators */}
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              notificationWS.isConnected ? "bg-green-500" : "bg-gray-400"
            )} 
            title={notificationWS.isConnected ? "Comments connected" : "Comments disconnected"}
            />
            <div className={cn(
              "w-2 h-2 rounded-full",
              messagingWS.isConnected ? "bg-blue-500" : "bg-gray-400"
            )} 
            title={messagingWS.isConnected ? "Typing indicators connected" : "Typing indicators disconnected"}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="p-1"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-600">
          <Input
            type="text"
            placeholder="Search comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border-l-4 border-red-400 text-red-700 text-sm">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Messages Container */}
      <div 
        className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No comments yet. Start the conversation!
          </div>
        ) : (
          comments
            .filter(comment => 
              !searchQuery || 
              comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
              comment.user.username.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map(comment => renderComment(comment))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Indicator */}
      {replyingTo && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600 dark:text-blue-400">
              Replying to comment...
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Typing Indicators */}
      {typingUsers.size > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span>
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        </div>
      )}



      {/* Input Area */}
      <div className="p-2 sm:p-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a comment..."
              className="w-full px-2 py-1.5 sm:px-3 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              rows={2}
              disabled={sending}
            />
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {allowMediaUpload && (
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-1.5 sm:p-2 attach-button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                >
                  <PaperClipIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
                
                {/* Attach Menu */}
                {showAttachMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2 z-50 attach-menu">
                    <button
                      onClick={handleFileAttach}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
                    >
                      📁 Upload File
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <div className="relative">
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-1.5 sm:p-2 emoji-button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <FaceSmileIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Button>
              
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2 sm:p-3 z-50 emoji-picker">
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-1 w-40 sm:w-48">
                    {['😀', '😃', '😄', '😁', '😊', '😍', '🤔', '😎', '😢', '😭', '😡', '🤯', '👍', '👎', '❤️', '💯', '🔥', '✨', '🎉', '🚀', '💪', '👏', '🙏', '💡'].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => addEmoji(emoji)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button
              onClick={handleSendComment}
              disabled={!newComment.trim() || sending}
              className="p-1.5 sm:p-2"
              size="sm"
            >
              {sending ? (
                <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PaperAirplaneIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleTaskComments;
