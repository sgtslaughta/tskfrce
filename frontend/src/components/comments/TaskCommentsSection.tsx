/**
 * TaskCommentsSection Component
 * 
 * Simplified SMS-like comment interface for task discussions with real-time updates,
 * media attachments, and rich text support.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Text,
  TextInput,
  ActionIcon,
  Avatar,
  Chip,
  Divider,
  Menu,
  Tooltip,
  Alert,
  Skeleton,
  useMantineTheme,
  Button,
  Group,
  Stack,
  Transition
} from '@mantine/core';
import {
  IconSend,
  IconPaperclip,
  IconMoodSmile,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconCornerDownRight,
  IconPhoto,
  IconVideo,
  IconMusic,
  IconFile,
  IconSearch
} from '@tabler/icons-react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

// Simplified interfaces
interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

interface MediaAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  user?: User;
  created_at: string;
  updated_at?: string;
  is_system_generated: boolean;
  media_attachments?: MediaAttachment[];
  parent_id?: string;
}

interface CommentWithReplies extends Comment {
  replies?: CommentWithReplies[];
}

interface TaskCommentsSectionProps {
  taskId: string;
  currentUser: User;
  comments: CommentWithReplies[];
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

const TaskCommentsSection: React.FC<TaskCommentsSectionProps> = ({
  taskId,
  currentUser,
  comments,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
  loading = false,
  error = null
}) => {
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const theme = useMantineTheme();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !replyingTo) return;
    
    try {
      await onAddComment(replyContent.trim(), replyingTo);
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to add reply:', error);
    }
  };

  const handleUpdateComment = async () => {
    if (!editingComment || !editingContent.trim()) return;
    
    try {
      await onUpdateComment(editingComment, editingContent.trim());
      setEditingComment(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM d, HH:mm');
    }
  };

  const getMediaIcon = (mediaType: string) => {
    if (mediaType.startsWith('image/')) return <IconPhoto size={16} />;
    if (mediaType.startsWith('video/')) return <IconVideo size={16} />;
    if (mediaType.startsWith('audio/')) return <IconMusic size={16} />;
    return <IconFile size={16} />;
  };

  const renderComment = (comment: CommentWithReplies, isReply = false) => {
    const isOwnComment = comment.user_id === currentUser.id;
    const isSystemComment = comment.is_system_generated;
    const isEditing = editingComment === comment.id;

    return (
      <Box key={comment.id} style={{ marginBottom: '12px' }}>
        <Paper
          p="sm"
          style={{
            marginLeft: isReply ? '24px' : '0',
            backgroundColor: isSystemComment ? theme.colors.gray[0] : 
                           isOwnComment ? theme.colors.blue[0] : theme.colors.gray[0]
          }}
        >
          {!isSystemComment && (
            <Group justify="space-between" mb="xs">
              <Group>
                <Avatar size="xs" radius="xl">
                  {comment.user?.firstName?.[0] || comment.user?.username?.[0] || 'U'}
                </Avatar>
                <Text size="xs" fw={600}>
                  {isOwnComment ? 'You' : comment.user?.firstName || comment.user?.username}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatMessageTime(comment.created_at)}
                </Text>
              </Group>
              
              {isOwnComment && (
                <Menu>
                  <Menu.Target>
                    <ActionIcon size="sm" variant="subtle">
                      <IconDotsVertical size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item 
                      onClick={() => {
                        setEditingComment(comment.id);
                        setEditingContent(comment.content);
                      }}
                      leftSection={<IconEdit size={16} />}
                    >
                      Edit
                    </Menu.Item>
                    <Menu.Item 
                      onClick={() => onDeleteComment(comment.id)}
                      leftSection={<IconTrash size={16} />}
                      color="red"
                    >
                      Delete
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          )}

          {/* Comment Content */}
          {isEditing ? (
            <Stack gap="xs">
              <TextInput
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                placeholder="Edit your comment..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleUpdateComment();
                  }
                  if (e.key === 'Escape') {
                    setEditingComment(null);
                    setEditingContent('');
                  }
                }}
              />
              <Group>
                <Button size="xs" onClick={handleUpdateComment}>
                  Save
                </Button>
                <Button 
                  size="xs" 
                  variant="subtle" 
                  onClick={() => {
                    setEditingComment(null);
                    setEditingContent('');
                  }}
                >
                  Cancel
                </Button>
              </Group>
            </Stack>
          ) : (
            <>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {comment.content}
              </Text>
              
              {/* Media Attachments */}
              {comment.media_attachments && comment.media_attachments.length > 0 && (
                <Stack gap="xs" mt="xs">
                  {comment.media_attachments.map((attachment) => (
                    <Group key={attachment.id} gap="xs">
                      {getMediaIcon(attachment.file_type)}
                      <Text size="xs" c="dimmed">
                        {attachment.file_name}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}
              
              {/* Reply Button */}
              {!isSystemComment && !isReply && (
                <Group justify="flex-end" mt="xs">
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconCornerDownRight size={14} />}
                    onClick={() => {
                      setReplyingTo(comment.id);
                    }}
                  >
                    Reply
                  </Button>
                </Group>
              )}
            </>
          )}
        </Paper>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <Box ml="md" mt="xs">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </Box>
        )}

        {/* Reply Input */}
        {replyingTo === comment.id && (
          <Box ml="md" mt="xs">
            <Group>
              <TextInput
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitReply();
                  }
                  if (e.key === 'Escape') {
                    setReplyingTo(null);
                    setReplyContent('');
                  }
                }}
                style={{ flex: 1 }}
              />
              <ActionIcon onClick={handleSubmitReply} disabled={!replyContent.trim()}>
                <IconSend size={16} />
              </ActionIcon>
              <ActionIcon 
                variant="subtle" 
                onClick={() => {
                  setReplyingTo(null);
                  setReplyContent('');
                }}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Box>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box p="md">
        <Stack gap="md">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} height={60} radius="md" />
          ))}
        </Stack>
      </Box>
    );
  }

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box p="md" style={{ borderBottom: `1px solid ${theme.colors.gray[3]}` }}>
        <Group justify="space-between">
          <Text size="lg" fw={600}>
            Task Comments
          </Text>
          <Text size="xs" c="dimmed">
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </Text>
        </Group>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert color="red" mb="md" onClose={() => {}}>
          {error}
        </Alert>
      )}

      {/* Comments List */}
      <Box
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          maxHeight: '400px'
        }}
      >
        {comments.length === 0 ? (
          <Box style={{ textAlign: 'center', padding: '32px 16px' }}>
            <Text c="dimmed">
              No comments yet. Start the conversation!
            </Text>
          </Box>
        ) : (
          <>
            {comments.map((comment) => renderComment(comment))}
            <div ref={messagesEndRef} />
          </>
        )}
      </Box>

      {/* Comment Input */}
      <Box p="md" style={{ borderTop: `1px solid ${theme.colors.gray[3]}` }}>
        <Group>
          <TextInput
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
            }}
            style={{ flex: 1 }}
          />
          <ActionIcon onClick={handleSubmitComment} disabled={!newComment.trim()}>
            <IconSend size={16} />
          </ActionIcon>
        </Group>
      </Box>
    </Box>
  );
};

export default TaskCommentsSection;