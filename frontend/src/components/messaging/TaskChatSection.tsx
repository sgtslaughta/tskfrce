/**
 * TaskChatSection Component
 * 
 * Task-specific chat interface that allows team members to discuss
 * task details in real-time with context awareness.
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
  Chip,
  Badge,
  Divider,
  Tooltip,
  Alert,
  Skeleton,
  Transition,
  Menu,
  Group,
  Stack,
  ScrollArea,
  useMantineTheme
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconSend as SendIcon,
  IconPaperclip as AttachIcon,
  IconMoodSmile as EmojiIcon,
  IconPin as PinIcon,
  IconDots as MoreIcon,
  IconEdit as EditIcon,
  IconTrash as DeleteIcon,
  IconCornerDownLeft as ReplyIcon,
  IconPhoto as ImageIcon,
  IconVideo as VideoIcon,
  IconMusic as AudioIcon,
  IconFile as FileIcon,
  IconUsers as GroupIcon,
  IconBell as NotifyIcon
} from '@tabler/icons-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

import { TaskChatMessage } from '../../types/messaging';
import { Task } from '../../types/task';
import { User, OnlineStatus } from '../../types/user';
import { MediaAttachment } from '../../types/media';
import { messagingService, MessageResponse } from '../../services/messagingService';
import { mediaService } from '../../services/mediaService';
import { useWebSocket } from '../../hooks/useWebSocket';
// import MediaUploader from '../common/MediaUploader'; // Removed - common directory deleted

interface TaskChatSectionProps {
  task: Task;
  currentUser: User;
  maxHeight?: string | number;
  showParticipants?: boolean;
  allowMediaUpload?: boolean;
  showTypingIndicators?: boolean;
  autoScrollToBottom?: boolean;
}

interface ChatMessageWithActions extends TaskChatMessage {
  isEditing?: boolean;
  isPinned?: boolean;
  mentionedUsers?: User[];
}

const TaskChatSection: React.FC<TaskChatSectionProps> = ({
  task,
  currentUser,
  maxHeight = 500,
  showParticipants = true,
  allowMediaUpload = true,
  showTypingIndicators = true,
  autoScrollToBottom = true
}) => {
  const theme = useMantineTheme();
  const { subscribe, sendMessage, isConnected } = useWebSocket();
  const [menuOpened, { open: openMenu, close: closeMenu }] = useDisclosure(false);
  
  const [messages, setMessages] = useState<ChatMessageWithActions[]>([]);
  const [participants, setParticipants] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (autoScrollToBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoScrollToBottom]);

  // Periodic message polling for synchronization
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await messagingService.getTaskChatMessages(task.id, {
          include_media: true,
          include_mentions: true,
          sort_by: 'created_at',
          sort_order: 'asc'
        });
        
        // Update messages, avoiding duplicates
        setMessages(prev => {
          // Create a map of existing message IDs for deduplication
          const existingIds = new Set(prev.map(msg => msg.id));
          const newMessages = response.messages.filter(msg => !existingIds.has(msg.id));
          
          // Only update if there are new messages
          if (newMessages.length > 0) {
            return [...prev, ...newMessages];
          }
          
          return prev;
        });
      } catch (err) {
        console.warn('Failed to poll task chat messages:', err);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(pollInterval);
  }, [task.id]);

  // WebSocket event subscriptions
  useEffect(() => {
    const handleNewMessage = (data: any) => {
      if (data.task_id === task.id) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
    };

    const handleMessageUpdated = (data: any) => {
      if (data.task_id === task.id) {
        setMessages(prev => prev.map(msg => 
          msg.id === data.message.id ? { ...msg, ...data.message } : msg
        ));
      }
    };

    const handleMessageDeleted = (data: any) => {
      if (data.task_id === task.id) {
        setMessages(prev => prev.filter(msg => msg.id !== data.message_id));
      }
    };

    const handleTypingUpdate = (data: any) => {
      if (data.task_id === task.id && showTypingIndicators) {
        setTypingUsers(data.typing_users.filter((user: User) => user.id !== currentUser.id));
      }
    };

    const handleParticipantJoined = (data: any) => {
      if (data.task_id === task.id) {
        setParticipants(prev => [...prev, data.user]);
      }
    };

    const handleParticipantLeft = (data: any) => {
      if (data.task_id === task.id) {
        setParticipants(prev => prev.filter(p => p.id !== data.user_id));
      }
    };

    const unsubscribeNewMessage = subscribe('task_message_created', handleNewMessage);
    const unsubscribeMessageUpdated = subscribe('task_message_updated', handleMessageUpdated);
    const unsubscribeMessageDeleted = subscribe('task_message_deleted', handleMessageDeleted);
    const unsubscribeTyping = subscribe('user_typing_task', handleTypingUpdate);
    const unsubscribeParticipantJoined = subscribe('task_participant_joined', handleParticipantJoined);
    const unsubscribeParticipantLeft = subscribe('task_participant_left', handleParticipantLeft);

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageUpdated();
      unsubscribeMessageDeleted();
      unsubscribeTyping();
      unsubscribeParticipantJoined();
      unsubscribeParticipantLeft();
    };
  }, [task.id, currentUser.id, showTypingIndicators, subscribe, scrollToBottom]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const loadTaskChat = useCallback(async () => {
    try {
      setLoading(true);
      const response = await messagingService.getTaskChatMessages(task.id, {
        include_media: true,
        include_mentions: true,
        sort_by: 'created_at',
        sort_order: 'asc'
      });
      
      setMessages(response.messages);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat messages');
    } finally {
      setLoading(false);
    }
  }, [task.id]);

  const loadParticipants = useCallback(async () => {
    try {
      const response = await messagingService.getTaskChatParticipants(task.id);
      setParticipants(response.participants);
    } catch (err) {
      console.error('Failed to load participants:', err);
    }
  }, [task.id]);

  // Load chat data on mount
  useEffect(() => {
    loadTaskChat();
    loadParticipants();
  }, [task.id, loadTaskChat, loadParticipants]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() && selectedMedia.length === 0) return;

    const messageContent = newMessage.trim();
    const tempId = Date.now(); // Temporary ID for optimistic update

    try {
      let mediaAttachments: MediaAttachment[] = [];
      
      // Upload media files if any
      if (selectedMedia.length > 0) {
        const uploadPromises = selectedMedia.map(file => 
          mediaService.uploadMedia(file, 'task_message')
        );
        const uploadResults = await Promise.all(uploadPromises);
        mediaAttachments = uploadResults.map(result => result.media);
      }

      // Extract mentions from message content
      const mentionRegex = /@(\w+)/g;
      const mentions: number[] = [];
      let match: RegExpExecArray | null;
      while ((match = mentionRegex.exec(messageContent)) !== null) {
        const mentionedUser = participants.find(p => p.username === match![1]);
        if (mentionedUser) {
          mentions.push(mentionedUser.id);
        }
      }

      // Create optimistic message for immediate UI update
      const optimisticMessage: ChatMessageWithActions = {
        id: tempId,
        task_id: task.id,
        sender_id: currentUser.id,
        sender: currentUser,
        content: messageContent,
        media_attachments: mediaAttachments,
        reply_to_message_id: replyingTo || undefined,
        mentioned_users: mentions.map(id => participants.find(p => p.id === id)).filter(Boolean) as User[],
        is_pinned: false,
        is_edited: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Immediately add message to UI for instant feedback
      setMessages(prev => [...prev, optimisticMessage]);

      // Clear form immediately for better UX
      setNewMessage('');
      setSelectedMedia([]);
      setReplyingTo(null);
      setShowMentions(false);

      const messageData = {
        task_id: task.id,
        content: messageContent,
        reply_to_message_id: replyingTo || undefined,
        media_attachments: mediaAttachments.map(media => media.id),
        mentioned_user_ids: mentions
      };

      const response = await messagingService.sendTaskChatMessage(messageData);
      
      // Replace optimistic message with real message from server
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? response.message as TaskChatMessage : msg
      ));
      
      // Send typing stopped event
      sendMessage({
        type: 'typing_stopped_task',
        data: {
          task_id: task.id,
          user_id: currentUser.id
        }
      });

    } catch (err) {
      // Remove failed message from UI
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      
      // Restore form content on failure
      setNewMessage(messageContent);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleEditMessage = async (messageId: number, newContent: string) => {
    try {
      await messagingService.updateTaskChatMessage(messageId, {
        content: newContent
      });
      setEditingMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update message');
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await messagingService.deleteTaskChatMessage(messageId);
      closeMenu();
      setSelectedMessageId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message');
    }
  };

  const handlePinMessage = async (messageId: number) => {
    try {
      await messagingService.pinTaskChatMessage(messageId);
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isPinned: true } : msg
      ));
      closeMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pin message');
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    
    // Handle @ mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setMentionSuggestions(participants.filter(p => p.id !== currentUser.id));
      setShowMentions(true);
    } else if (lastAtIndex !== -1) {
      const searchTerm = value.substring(lastAtIndex + 1);
      if (searchTerm && !searchTerm.includes(' ')) {
        const filtered = participants.filter(p => 
          p.id !== currentUser.id && 
          p.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setMentionSuggestions(filtered);
        setShowMentions(filtered.length > 0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
    
    // Send typing indicator
    if (showTypingIndicators && value.trim()) {
      sendMessage({
        type: 'typing_started_task',
        data: {
          task_id: task.id,
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
          type: 'typing_stopped_task',
          data: {
            task_id: task.id,
            user_id: currentUser.id
          }
        });
      }, 3000);
    }
  };

  const handleMentionSelect = (user: User) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    const beforeMention = newMessage.substring(0, lastAtIndex);
    const afterMention = newMessage.substring(newMessage.length);
    setNewMessage(`${beforeMention}@${user.username} ${afterMention}`);
    setShowMentions(false);
    inputRef.current?.focus();
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
    if (mediaType.startsWith('image/')) return <ImageIcon size={16} />;
    if (mediaType.startsWith('video/')) return <VideoIcon size={16} />;
    if (mediaType.startsWith('audio/')) return <AudioIcon size={16} />;
    return <FileIcon size={16} />;
  };

  const renderMessage = (message: ChatMessageWithActions) => {
    const isOwnMessage = message.sender_id === currentUser.id;
    const sender = message.sender;

    return (
      <Group
        key={message.id}
        justify={isOwnMessage ? 'flex-end' : 'flex-start'}
        mb="xs"
        align="flex-start"
        style={{ position: 'relative' }}
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
            borderRadius: isOwnMessage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            position: 'relative'
          }}
        >
          {/* Pin indicator */}
          {message.isPinned && (
            <Tooltip label="Pinned message">
              <PinIcon 
                size={16}
                style={{ 
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  color: theme.colors.yellow[6]
                }} 
              />
            </Tooltip>
          )}

          {/* Reply indicator */}
          {message.reply_to_message_id && (
            <Box 
              mb="xs"
              p="xs"
              style={{
                backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : theme.colors.gray[2],
                borderRadius: theme.radius.sm,
                borderLeft: `3px solid ${theme.colors.primary[6]}`
              }}
            >
              <Text size="xs" style={{ opacity: 0.8 }}>
                Replying to message...
              </Text>
            </Box>
          )}

          {/* Message Header */}
          <Group justify="space-between" align="center" mb="xs">
            <Text 
              size="xs"
              fw={600}
              style={{ opacity: isOwnMessage ? 0.9 : 0.7 }}
            >
              {isOwnMessage ? 'You' : sender?.first_name || sender?.username}
            </Text>
            
            <Group gap="xs" align="center">
              <Text 
                size="xs"
                style={{ opacity: isOwnMessage ? 0.8 : 0.6 }}
              >
                {formatMessageTime(message.created_at)}
              </Text>
              
              <Menu opened={menuOpened} onClose={closeMenu}>
                <Menu.Target>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    style={{ 
                      color: 'inherit', 
                      opacity: 0.7
                    }}
                    onClick={(e) => {
                      setAnchorEl(e.currentTarget);
                      setSelectedMessageId(message.id);
                      openMenu();
                    }}
                  >
                    <MoreIcon size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item 
                    leftSection={<ReplyIcon size={16} />}
                    onClick={() => {
                      setReplyingTo(message.id);
                      closeMenu();
                    }}
                  >
                    Reply
                  </Menu.Item>
                  <Menu.Item 
                    leftSection={<PinIcon size={16} />}
                    onClick={() => handlePinMessage(message.id)}
                  >
                    Pin Message
                  </Menu.Item>
                  {message.sender_id === currentUser.id && (
                    <>
                      <Menu.Item 
                        leftSection={<EditIcon size={16} />}
                        onClick={() => {
                          setEditingMessage(message.id);
                          closeMenu();
                        }}
                      >
                        Edit
                      </Menu.Item>
                      <Menu.Item 
                        leftSection={<DeleteIcon size={16} />}
                        color="red"
                        onClick={() => handleDeleteMessage(message.id)}
                      >
                        Delete
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>

          {/* Message Content */}
          {editingMessage === message.id ? (
            <Textarea
              autosize
              defaultValue={message.content}
              onBlur={(e) => handleEditMessage(message.id, e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  handleEditMessage(message.id, e.currentTarget.value);
                }
              }}
              autoFocus
            />
          ) : (
            <Text 
              size="sm"
              style={{ 
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
            >
              {/* Render mentions with highlighting */}
              {message.content.split(/(@\w+)/).map((part, index) => 
                part.startsWith('@') ? (
                  <Chip
                    key={index}
                    size="xs"
                    style={{ 
                      backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : theme.colors.primary[1],
                      color: isOwnMessage ? 'inherit' : theme.colors.primary[7]
                    }}
                  >
                    {part}
                  </Chip>
                ) : part
              )}
            </Text>
          )}

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

          {/* Reply Button */}
          <Group justify="flex-end" mt="xs">
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => setReplyingTo(message.id)}
              style={{ 
                color: 'inherit', 
                opacity: 0.6
              }}
            >
              <ReplyIcon size={16} />
            </ActionIcon>
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

  const renderTypingIndicators = () => {
    if (!showTypingIndicators || typingUsers.length === 0) return null;

    return (
      <Transition mounted={true} transition="slide-up" duration={200}>
        {(styles) => (
          <Group p="sm" style={{ ...styles, opacity: 0.7 }}>
            <Avatar size={24} radius="xl">
              {typingUsers[0].first_name?.[0] || typingUsers[0].username[0]}
            </Avatar>
            <Text size="xs">
              {typingUsers.length === 1 
                ? `${typingUsers[0].first_name || typingUsers[0].username} is typing...`
                : `${typingUsers.length} people are typing...`
              }
            </Text>
            <Group gap="xs">
              {[0, 1, 2].map(i => (
                <Box
                  key={i}
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    backgroundColor: theme.colors.gray[6],
                    animation: 'pulse 1.4s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`
                  }}
                />
              ))}
            </Group>
          </Group>
        )}
      </Transition>
    );
  };

  const renderParticipants = () => {
    if (!showParticipants) return null;

    return (
      <Box p="md" style={{ borderBottom: `1px solid ${theme.colors.gray[3]}` }}>
        <Group gap="sm" mb="sm">
          <GroupIcon size={16} />
          <Text size="sm" fw={500}>
            Participants ({participants.length})
          </Text>
          {!isConnected && (
            <Chip size="xs" color="red" variant="outline">Offline</Chip>
          )}
        </Group>
        
        <Group gap="xs">
          {participants.map((participant) => (
            <Tooltip
              key={participant.id}
              label={`${participant.first_name} ${participant.last_name}`.trim() || participant.username}
            >
              <Badge
                color={participant.online_status === OnlineStatus.ONLINE ? "green" : "gray"}
                variant="dot"
                size="sm"
              >
                <Avatar
                  size={32}
                  src={participant.avatar_url}
                  radius="xl"
                >
                  {participant.first_name?.[0] || participant.username[0]}
                </Avatar>
              </Badge>
            </Tooltip>
          ))}
        </Group>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box p="md">
        <Skeleton height={60} mb="md" />
        {[1, 2, 3].map((item) => (
          <Group key={item} align="flex-start" mb="md">
            <Skeleton circle height={32} />
            <Skeleton height={60} flex={1} />
          </Group>
        ))}
      </Box>
    );
  }

  return (
    <Stack h="100%" gap={0}>
      {/* Header */}
      <Box p="md" style={{ borderBottom: `1px solid ${theme.colors.gray[3]}` }}>
        <Text fw={600} size="lg">
          Task Discussion
        </Text>
        <Text size="sm" c="dimmed">
          {task.title}
        </Text>
      </Box>

      {/* Participants */}
      {renderParticipants()}

      {/* Error Alert */}
      {error && (
        <Alert title="Error" color="red" onClose={() => setError(null)} m="sm">
          {error}
        </Alert>
      )}

      {/* Messages Container */}
      <ScrollArea 
        flex={1}
        style={{ maxHeight }}
        p="sm"
      >
        {messages.length === 0 ? (
          <Stack align="center" py="xl">
            <Text c="dimmed" ta="center">
              No messages yet. Start the discussion!
            </Text>
          </Stack>
        ) : (
          messages.map(renderMessage)
        )}

        {renderTypingIndicators()}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Reply Indicator */}
      {replyingTo && (
        <Box px="md" py="sm" style={{ backgroundColor: theme.colors.gray[1] }}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Replying to message...
            </Text>
            <ActionIcon 
              size="sm" 
              onClick={() => setReplyingTo(null)}
            >
              <DeleteIcon size={16} />
            </ActionIcon>
          </Group>
        </Box>
      )}

      {/* Mention Suggestions */}
      {showMentions && (
        <Box mx="md" mb="sm">
          <Paper shadow="md" style={{ maxHeight: 150 }}>
            <ScrollArea>
              <Stack gap={0}>
                {mentionSuggestions.map((user) => (
                  <Group
                    key={user.id}
                    p="sm"
                    gap="sm"
                    onClick={() => handleMentionSelect(user)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.colors.gray[0];
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Avatar size={24} src={user.avatar_url} radius="xl">
                      {user.first_name?.[0] || user.username[0]}
                    </Avatar>
                    <Stack gap={0}>
                      <Text size="sm">@{user.username}</Text>
                      <Text size="xs" c="dimmed">
                        {`${user.first_name} ${user.last_name}`.trim()}
                      </Text>
                    </Stack>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Paper>
        </Box>
      )}

      {/* Input Area */}
      <Box p="md" style={{ borderTop: `1px solid ${theme.colors.gray[3]}` }}>
        <Group align="flex-end" gap="sm">
          {allowMediaUpload && (
            /* <MediaUploader
              onFilesSelected={setSelectedMedia}
              maxFiles={5}
              acceptedTypes={['image/*', 'video/*', 'audio/*', '.pdf', '.doc', '.docx']}
            >*/
              <ActionIcon size="sm" color="primary">
                <AttachIcon size={16} />
              </ActionIcon>
            /* </MediaUploader> */
          )}

          <Textarea
            ref={inputRef}
            placeholder="Type a message... Use @username to mention someone"
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

export default TaskChatSection;