/**
 * DirectMessaging Component
 * 
 * Real-time direct messaging interface between users with conversation history,
 * media support, and typing indicators.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Text,
  TextInput,
  Textarea,
  ActionIcon,
  Avatar,
  ScrollArea,
  Badge,
  Divider,
  Chip,
  Drawer,
  Skeleton,
  Alert,
  Tooltip,
  Group,
  Stack,
  useMantineTheme
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconSend as SendIcon,
  IconSearch as SearchIcon,
  IconPaperclip as AttachIcon,
  IconMoodSmile as EmojiIcon,
  IconX as CloseIcon,
  IconPoint as OnlineIcon,
  IconPhoto as ImageIcon,
  IconVideo as VideoIcon,
  IconMusic as AudioIcon,
  IconFile as FileIcon
} from '@tabler/icons-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

import { DirectMessage, Conversation } from '../../types/messaging';
import { User, OnlineStatus } from '../../types/user';
import { MediaAttachment } from '../../types/media';
import { messagingService, MessageResponse } from '../../services/messagingService';
import { mediaService } from '../../services/mediaService';
import { userService } from '../../services/userService';
import { useWebSocket } from '../../hooks/useWebSocket';
// import MediaUploader from '../common/MediaUploader'; // Removed - common directory deleted
import ReadReceiptIndicator from './ReadReceiptIndicator';

interface DirectMessagingProps {
  currentUser: User;
  initialConversationId?: number;
  onConversationChange?: (conversation: Conversation | null) => void;
  drawerWidth?: number;
  isMobile?: boolean;
}

interface ConversationWithMessages extends Conversation {
  messages: DirectMessage[];
  typingUsers: User[];
  isLoading: boolean;
}

const DirectMessaging: React.FC<DirectMessagingProps> = ({
  currentUser,
  initialConversationId,
  onConversationChange,
  drawerWidth = 300,
  isMobile = false
}) => {
  const theme = useMantineTheme();
  const isMobileScreen = useMediaQuery('(max-width: 768px)');
  const { subscribe, sendMessage, isConnected } = useWebSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationWithMessages | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageDeliveryStatus, setMessageDeliveryStatus] = useState<Record<number, any>>({});
  const [newMessage, setNewMessage] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(!isMobileScreen);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // Periodic message polling for synchronization
  useEffect(() => {
    if (!activeConversation) return;

    const pollInterval = setInterval(async () => {
      try {
        const messages = await loadConversationMessages(activeConversation.id);
        
        // Update messages, avoiding duplicates
        setActiveConversation(prev => {
          if (!prev) return null;
          
          // Create a map of existing message IDs for deduplication
          const existingIds = new Set((prev.messages || []).map(msg => msg.id));
          const newMessages = messages.filter(msg => !existingIds.has(msg.id));
          
          // Only update if there are new messages
          if (newMessages.length > 0) {
            return {
              ...prev,
              messages: [...(prev.messages || []), ...newMessages]
            };
          }
          
          return prev;
        });
      } catch (err) {
        console.warn('Failed to poll messages:', err);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [activeConversation]);

  // WebSocket event subscriptions
  useEffect(() => {
    const handleNewMessage = (data: any) => {
      if (activeConversation && data.conversation_id === activeConversation.id) {
        setActiveConversation(prev => prev ? {
          ...prev,
          messages: [...prev.messages, data.message]
        } : null);
        scrollToBottom();
      }
      
      // Update conversation list
      setConversations(prev => prev.map(conv => 
        conv.id === data.conversation_id 
          ? { 
              ...conv, 
              last_message: data.message,
              updated_at: data.message.created_at,
              unread_count: conv.id === activeConversation?.id ? 0 : (conv.unread_count || 0) + 1
            }
          : conv
      ));
    };

    const handleTypingUpdate = (data: any) => {
      if (activeConversation && data.conversation_id === activeConversation.id) {
        setActiveConversation(prev => prev ? {
          ...prev,
          typingUsers: data.typing_users.filter((user: User) => user.id !== currentUser.id)
        } : null);
      }
    };

    const handleUserStatusUpdate = (data: any) => {
      setUsers(prev => prev.map(user => 
        user.id === data.user_id 
          ? { ...user, online_status: data.is_online ? OnlineStatus.ONLINE : OnlineStatus.OFFLINE, last_seen: data.last_seen }
          : user
      ));
    };

    const handleMessageRead = (data: any) => {
      if (activeConversation && data.conversation_id === activeConversation.id) {
        setActiveConversation(prev => prev ? {
          ...prev,
          messages: prev.messages.map(msg => 
            msg.id === data.message_id ? { ...msg, read_at: data.read_at } : msg
          )
        } : null);
      }
    };

    const unsubscribeNewMessage = subscribe('direct_message_received', handleNewMessage);
    const unsubscribeTyping = subscribe('user_typing_direct', handleTypingUpdate);
    const unsubscribeUserStatus = subscribe('user_status_changed', handleUserStatusUpdate);
    const unsubscribeMessageRead = subscribe('message_read', handleMessageRead);

    return () => {
      unsubscribeNewMessage();
      unsubscribeTyping();
      unsubscribeUserStatus();
      unsubscribeMessageRead();
    };
  }, [activeConversation, currentUser.id, subscribe, scrollToBottom]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await messagingService.getConversations();
      setConversations(response.conversations);
    } catch (err) {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const response = await userService.getUsers();
      setUsers(response.users.filter(user => user.id !== currentUser.id));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [currentUser.id]);

  const loadConversationMessages = async (conversationId: number) => {
    try {
      const response = await messagingService.getConversationMessages(conversationId);
      return response.messages;
    } catch (err) {
      throw new Error('Failed to load messages');
    }
  };

  const handleConversationSelect = useCallback(async (conversation: Conversation) => {
    try {
      setActiveConversation({
        ...conversation,
        messages: [],
        typingUsers: [],
        isLoading: true
      });

      const messages = await loadConversationMessages(conversation.id);
      
      setActiveConversation(prev => prev ? {
        ...prev,
        messages,
        isLoading: false
      } : null);

      // Mark messages as read
      await messagingService.markConversationAsRead(conversation.id);
      
      // Update unread count in conversations list
      setConversations(prev => prev.map(conv => 
        conv.id === conversation.id ? { ...conv, unread_count: 0 } : conv
      ));

      onConversationChange?.(conversation);
      scrollToBottom();

      if (isMobileScreen) {
        setDrawerOpen(false);
      }
    } catch (err) {
      setError('Failed to load conversation');
    }
  }, [onConversationChange, scrollToBottom, isMobileScreen]);

  // Set initial conversation
  useEffect(() => {
    if (initialConversationId && conversations.length > 0) {
      const conversation = conversations.find(c => c.id === initialConversationId);
      if (conversation) {
        handleConversationSelect(conversation);
      }
    }
  }, [initialConversationId, conversations, handleConversationSelect]);

  // Load initial data
  useEffect(() => {
    loadConversations();
    loadUsers();
  }, [loadConversations, loadUsers]);

  const handleStartNewConversation = async (user: User) => {
    try {
      const response = await messagingService.createConversation({
        participant_ids: [user.id],
        type: 'direct'
      });
      
      const newConversation = response.conversation;
      setConversations(prev => [newConversation, ...prev]);
      handleConversationSelect(newConversation);
    } catch (err) {
      setError('Failed to start conversation');
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversation || (!newMessage.trim() && selectedMedia.length === 0)) return;

    const messageContent = newMessage.trim();
    const tempId = Date.now(); // Temporary ID for optimistic update

    try {
      let mediaAttachments: MediaAttachment[] = [];
      
      // Upload media files if any
      if (selectedMedia.length > 0) {
        const uploadPromises = selectedMedia.map(file => 
          mediaService.uploadMedia(file, 'message')
        );
        const uploadResults = await Promise.all(uploadPromises);
        mediaAttachments = uploadResults.map(result => result.media);
      }

      // Create optimistic message for immediate UI update
      const optimisticMessage: DirectMessage = {
        id: tempId,
        conversation_id: activeConversation.id,
        sender_id: currentUser.id,
        sender: currentUser,
        content: messageContent,
        media_attachments: mediaAttachments,
        is_edited: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Immediately add message to UI for instant feedback
      setActiveConversation(prev => prev ? {
        ...prev,
        messages: [...(prev.messages || []), optimisticMessage]
      } : null);

      // Clear form immediately for better UX
      setNewMessage('');
      setSelectedMedia([]);

      const messageData = {
        conversation_id: activeConversation.id,
        content: messageContent,
        media_attachments: mediaAttachments.map(media => media.id)
      };

      const response = await messagingService.sendDirectMessage(messageData);
      
      // Replace optimistic message with real message from server
      setActiveConversation(prev => prev ? {
        ...prev,
        messages: (prev.messages || []).map(msg => 
          msg.id === tempId ? response.message as DirectMessage : msg
        )
      } : null);
      
      // Send typing stopped event
      sendMessage({
        type: 'typing_stopped_direct',
        data: {
          conversation_id: activeConversation.id,
          user_id: currentUser.id
        }
      });

    } catch (err) {
      // Remove failed message from UI
      setActiveConversation(prev => prev ? {
        ...prev,
        messages: (prev.messages || []).filter(msg => msg.id !== tempId)
      } : null);
      
      // Restore form content on failure
      setNewMessage(messageContent);
      setError('Failed to send message');
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    
    // Send typing indicator
    if (activeConversation && value.trim()) {
      sendMessage({
        type: 'typing_started_direct',
        data: {
          conversation_id: activeConversation.id,
          user_id: currentUser.id
        }
      });

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set timeout to send typing stopped
      typingTimeoutRef.current = setTimeout(() => {
        sendMessage({
          type: 'typing_stopped_direct',
          data: {
            conversation_id: activeConversation.id,
            user_id: currentUser.id
          }
        });
      }, 3000);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM d, HH:mm');
    }
  };

  const getMediaIcon = (mediaType: string) => {
    if (mediaType.startsWith('image/')) return <ImageIcon />;
    if (mediaType.startsWith('video/')) return <VideoIcon />;
    if (mediaType.startsWith('audio/')) return <AudioIcon />;
    return <FileIcon />;
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredConversations = conversations.filter(conv => 
    conv.participants.some(p => 
      p.id !== currentUser.id && (
        p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
  );

  const renderMessage = (message: DirectMessage) => {
    const isOwnMessage = message.sender_id === currentUser.id;
    const sender = message.sender;

    return (
      <Group
        key={message.id}
        justify={isOwnMessage ? 'flex-end' : 'flex-start'}
        mb="xs"
        align="flex-start"
      >
        {!isOwnMessage && (
          <Avatar
            size={32}
            src={sender?.avatar_url}
            radius="xl"
          >
            {sender?.first_name?.[0] || sender?.username[0]}
          </Avatar>
        )}

        <Paper
          p="md"
          style={{
            maxWidth: '70%',
            minWidth: 120,
            backgroundColor: isOwnMessage ? theme.colors.primary[6] : theme.colors.gray[1],
            color: isOwnMessage ? 'white' : theme.colors.dark[7],
            borderRadius: isOwnMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px'
          }}
        >
          <Text 
            size="sm"
            style={{ 
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {message.content}
          </Text>

          {/* Media Attachments */}
          {message.media_attachments && message.media_attachments.length > 0 && (
            <Group mt="xs" gap="xs">
              {message.media_attachments.map((media, index) => (
                <Chip
                  key={index}
                  size="sm"
                  onClick={() => mediaService.downloadMedia(media.id)}
                  style={{ 
                    backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : theme.colors.gray[2],
                    cursor: 'pointer'
                  }}
                >
                  <Group gap="xs">
                    {getMediaIcon(media.mime_type)}
                    {media.filename}
                  </Group>
                </Chip>
              ))}
            </Group>
          )}

          <Group justify="space-between" align="center" mt="xs">
            <Text 
              size="xs" 
              style={{ opacity: isOwnMessage ? 0.8 : 0.6 }}
            >
              {formatMessageTime(message.created_at)}
            </Text>
            
            {isOwnMessage && activeConversation && (
              <ReadReceiptIndicator
                deliveryStatus={{
                  message_id: message.id,
                  status: message.read_at ? 'read' : 'delivered',
                  read_by: message.read_at ? [{
                    user: activeConversation.participants.find(p => p.id !== currentUser.id)!,
                    read_at: message.read_at
                  }] : undefined,
                  updated_at: message.updated_at
                }}
                currentUserId={currentUser.id}
              />
            )}
          </Group>
        </Paper>

        {isOwnMessage && (
          <Avatar
            size={32}
            src={currentUser.avatar_url}
            radius="xl"
          >
            {currentUser.first_name?.[0] || currentUser.username[0]}
          </Avatar>
        )}
      </Group>
    );
  };

  const renderConversationsList = () => (
    <Stack h="100%" gap={0}>
      {/* Header */}
      <Box p="md" style={{ borderBottom: `1px solid ${theme.colors.gray[3]}` }}>
        <Text fw={600} size="lg">Messages</Text>
        {!isConnected && (
          <Text size="xs" c="red">
            Disconnected - trying to reconnect...
          </Text>
        )}
      </Box>

      {/* Search */}
      <Box p="md">
        <TextInput
          placeholder="Search conversations or users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftSection={<SearchIcon size={16} />}
          size="sm"
        />
      </Box>

      {/* Conversations */}
      <ScrollArea flex={1}>
        {loading ? (
          <Box p="sm">
            {[1, 2, 3].map((item) => (
              <Group key={item} p="md" gap="md">
                <Skeleton circle height={40} />
                <Stack gap="xs" flex={1}>
                  <Skeleton height={16} width="60%" />
                  <Skeleton height={12} width="40%" />
                </Stack>
              </Group>
            ))}
          </Box>
        ) : (
          <Stack gap={0}>
            {/* Existing Conversations */}
            {filteredConversations.map((conversation) => {
              const otherParticipant = conversation.participants.find(p => p.id !== currentUser.id);
              if (!otherParticipant) return null;

              return (
                <Group
                  key={conversation.id}
                  p="md"
                  gap="md"
                  onClick={() => handleConversationSelect(conversation)}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: activeConversation?.id === conversation.id ? theme.colors.primary[0] : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (activeConversation?.id !== conversation.id) {
                      e.currentTarget.style.backgroundColor = theme.colors.gray[0];
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeConversation?.id !== conversation.id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Badge
                    color={otherParticipant.online_status === OnlineStatus.ONLINE ? "green" : "gray"}
                    variant="dot"
                    size="sm"
                  >
                    <Avatar src={otherParticipant.avatar_url} radius="xl">
                      {otherParticipant.first_name?.[0] || otherParticipant.username[0]}
                    </Avatar>
                  </Badge>
                  <Stack gap="xs" flex={1}>
                    <Text fw={500} size="sm">
                      {`${otherParticipant.first_name} ${otherParticipant.last_name}`.trim() || otherParticipant.username}
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                      truncate
                      style={{ maxWidth: 180 }}
                    >
                      {conversation.last_message?.content || 'No messages yet'}
                    </Text>
                  </Stack>
                  {conversation.unread_count && conversation.unread_count > 0 && (
                    <Badge color="primary" size="sm">
                      {conversation.unread_count}
                    </Badge>
                  )}
                </Group>
              );
            })}

            {/* Available Users for New Conversations */}
            {searchQuery && (
              <>
                <Divider my="sm" />
                <Text size="xs" c="dimmed" px="md">
                  Start new conversation
                </Text>
                {filteredUsers.map((user) => (
                  <Group
                    key={user.id}
                    p="md"
                    gap="md"
                    onClick={() => handleStartNewConversation(user)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.gray[0];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Badge
                      color={user.online_status === OnlineStatus.ONLINE ? "green" : "gray"}
                      variant="dot"
                      size="sm"
                    >
                      <Avatar src={user.avatar_url} radius="xl">
                        {user.first_name?.[0] || user.username[0]}
                      </Avatar>
                    </Badge>
                    <Stack gap="xs" flex={1}>
                      <Text fw={500} size="sm">
                        {`${user.first_name} ${user.last_name}`.trim() || user.username}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {user.online_status === OnlineStatus.ONLINE ? 'Online' : `Last seen ${formatDistanceToNow(new Date(user.last_seen || ''), { addSuffix: true })}`}
                      </Text>
                    </Stack>
                  </Group>
                ))}
              </>
            )}
          </Stack>
        )}
      </ScrollArea>
    </Stack>
  );

  const renderChatArea = () => {
    if (!activeConversation) {
      return (
        <Stack
          align="center" 
          justify="center" 
          h="100%"
          gap="md"
        >
          <Text size="lg" c="dimmed" fw={500}>
            Select a conversation to start messaging
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Choose from your existing conversations or search for users to start a new chat
          </Text>
        </Stack>
      );
    }

    const otherParticipant = activeConversation.participants.find(p => p.id !== currentUser.id);

    return (
      <Stack h="100%" gap={0}>
        {/* Chat Header */}
        <Group
          p="md" 
          style={{ borderBottom: `1px solid ${theme.colors.gray[3]}` }}
          gap="md"
        >
          {isMobileScreen && (
            <ActionIcon onClick={() => setDrawerOpen(true)}>
              <CloseIcon size={16} />
            </ActionIcon>
          )}
          
          <Badge
            color={otherParticipant?.online_status === OnlineStatus.ONLINE ? "green" : "gray"}
            variant="dot"
            size="sm"
          >
            <Avatar src={otherParticipant?.avatar_url} radius="xl">
              {otherParticipant?.first_name?.[0] || otherParticipant?.username[0]}
            </Avatar>
          </Badge>
          
          <Stack gap="xs">
            <Text fw={600} size="lg">
              {`${otherParticipant?.first_name} ${otherParticipant?.last_name}`.trim() || otherParticipant?.username}
            </Text>
            <Text size="xs" c="dimmed">
              {otherParticipant?.online_status === OnlineStatus.ONLINE ? 'Online' : `Last seen ${formatDistanceToNow(new Date(otherParticipant?.last_seen || ''), { addSuffix: true })}`}
            </Text>
          </Stack>
        </Group>

        {/* Error Alert */}
        {error && (
          <Alert title="Error" color="red" onClose={() => setError(null)} m="sm">
            {error}
          </Alert>
        )}

        {/* Messages */}
        <ScrollArea flex={1} p="sm">
          {activeConversation.isLoading ? (
            <Box p="md">
              {[1, 2, 3].map((item) => (
                <Group key={item} align="flex-start" mb="md">
                  <Skeleton circle height={32} />
                  <Skeleton height={60} flex={1} />
                </Group>
              ))}
            </Box>
          ) : (
            <>
              {activeConversation.messages.map(renderMessage)}
              
              {/* Typing Indicators */}
              {activeConversation.typingUsers.length > 0 && (
                <Group p="sm" style={{ opacity: 0.7 }}>
                  <Avatar size={24} radius="xl">
                    {activeConversation.typingUsers[0].first_name?.[0] || activeConversation.typingUsers[0].username[0]}
                  </Avatar>
                  <Text size="xs">
                    {activeConversation.typingUsers[0].first_name || activeConversation.typingUsers[0].username} is typing...
                  </Text>
                </Group>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </ScrollArea>

        {/* Input Area */}
        <Box p="md" style={{ borderTop: `1px solid ${theme.colors.gray[3]}` }}>
          <Group align="flex-end" gap="sm">
            {/* <MediaUploader
              onFilesSelected={setSelectedMedia}
              maxFiles={5}
              acceptedTypes={['image/*', 'video/*', 'audio/*', '.pdf', '.doc', '.docx']}
            >*/}
              <ActionIcon size="sm" color="primary">
                <AttachIcon size={16} />
              </ActionIcon>
            {/* </MediaUploader> */}

            <Textarea
              ref={inputRef}
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={handleKeyPress}
              flex={1}
              radius="xl"
              autosize
              maxRows={4}
            />

            <ActionIcon
              color="primary"
              onClick={handleSendMessage}
              disabled={!newMessage.trim() && selectedMedia.length === 0}
            >
              <SendIcon size={16} />
            </ActionIcon>
          </Group>

          {/* Selected Media Preview */}
          {selectedMedia.length > 0 && (
            <Group mt="sm" gap="xs">
              {selectedMedia.map((file, index) => (
                <Group key={index} gap="xs" style={{ position: 'relative' }}>
                  <Chip
                    size="sm"
                  >
                    <Group gap="xs">
                      {getMediaIcon(file.type)}
                      {file.name}
                    </Group>
                  </Chip>
                  <ActionIcon
                    size="xs"
                    color="red"
                    variant="subtle"
                    onClick={() => setSelectedMedia(prev => prev.filter((_, i) => i !== index))}
                    style={{ position: 'absolute', top: -5, right: -5 }}
                  >
                    ×
                  </ActionIcon>
                </Group>
              ))}
            </Group>
          )}
        </Box>
      </Stack>
    );
  };

  return (
    <Group h="100%" gap={0} align="flex-start">
      {/* Conversations Sidebar */}
      {isMobileScreen ? (
        <Drawer
          opened={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size={drawerWidth}
          position="left"
        >
          {renderConversationsList()}
        </Drawer>
      ) : (
        <Paper
          w={drawerWidth}
          h="100%"
          style={{ borderRight: `1px solid ${theme.colors.gray[3]}` }}
        >
          {renderConversationsList()}
        </Paper>
      )}

      {/* Chat Area */}
      <Box flex={1} h="100%">
        {renderChatArea()}
      </Box>
    </Group>
  );
};

export default DirectMessaging;