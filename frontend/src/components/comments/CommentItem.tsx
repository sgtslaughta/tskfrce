/**
 * @fileoverview Comment Item component for TaaskMaaster
 * @description Individual comment display component with actions
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { Button } from '../../design-system/components/Button';
import { cn } from '../../design-system/utils/cn';
import { Comment, commentService } from '../../services/commentService';
import { CommentForm } from './CommentForm';

/**
 * @description Comment item props interface
 */
interface CommentItemProps {
  comment: Comment;
  currentUserId?: number;
  onUpdate?: (comment: Comment) => void;
  onDelete?: (commentId: number) => void;
  onReply?: (comment: Comment) => void;
  className?: string;
  showReplies?: boolean;
  level?: number;
}

/**
 * @description Comment Item Component
 * @param props - Component props
 * @returns JSX.Element
 */
export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onUpdate,
  onDelete,
  onReply,
  className,
  showReplies = true,
  level = 0,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  const isOwner = currentUserId === comment.user_id;
  const isSystemComment = false; // TODO: Add system comment support
  const maxLevel = 3; // Maximum nesting level for replies

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  /**
   * Get user display name
   */
  const getUserDisplayName = (): string => {
    if (!comment.user) return 'Unknown User';
    
    const { full_name, username } = comment.user;
    if (full_name) {
      return full_name;
    } else {
      return username;
    }
  };

  /**
   * Render comment content with markdown support
   */
  const renderContent = () => {
    const content = comment.content;
    const shouldTruncate = content.length > 300 && !showFullContent;
    const displayContent = shouldTruncate ? content.substring(0, 300) + '...' : content;

    if (comment.content_type === 'markdown') {
      // Simple markdown rendering (you might want to use a proper markdown library)
      return (
        <div className="prose prose-sm max-w-none">
          <div
            dangerouslySetInnerHTML={{
              __html: displayContent
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
                .replace(/\n/g, '<br>'),
            }}
          />
          {shouldTruncate && (
            <button
              onClick={() => setShowFullContent(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Show more
            </button>
          )}
        </div>
      );
    } else {
      return (
        <div className="whitespace-pre-wrap text-gray-900">
          {displayContent}
          {shouldTruncate && (
            <button
              onClick={() => setShowFullContent(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium ml-1"
            >
              Show more
            </button>
          )}
        </div>
      );
    }
  };

  /**
   * Handle edit submission
   */
  const handleEditSubmit = (updatedComment: Comment) => {
    setIsEditing(false);
    onUpdate?.(updatedComment);
  };

  /**
   * Handle reply submission
   */
  const handleReplySubmit = (newComment: Comment) => {
    setIsReplying(false);
    onReply?.(newComment);
  };

  /**
   * Handle delete action
   */
  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await commentService.deleteComment(comment.id);
      onDelete?.(comment.id);
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        'group',
        level > 0 && 'ml-8 border-l-2 border-gray-100 pl-4',
        isSystemComment && 'bg-blue-50 border border-blue-100 rounded-lg p-3',
        className
      )}
    >
      {/* Comment Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* User Avatar */}
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
              isSystemComment
                ? 'bg-blue-500 text-white'
                : 'bg-gray-500 text-white'
            )}
          >
            {isSystemComment ? '🤖' : getUserDisplayName().charAt(0).toUpperCase()}
          </div>
          
          {/* User Name and Timestamp */}
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(
              'font-medium',
              isSystemComment ? 'text-blue-700' : 'text-gray-900'
            )}>
              {isSystemComment ? 'System' : getUserDisplayName()}
            </span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-500">
              {formatTimestamp(comment.created_at)}
            </span>
            {comment.updated_at !== comment.created_at && (
              <>
                <span className="text-gray-500">•</span>
                <span className="text-gray-500 text-xs">edited</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!isSystemComment && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {level < maxLevel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsReplying(!isReplying)}
                className="text-xs"
              >
                Reply
              </Button>
            )}
            {isOwner && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Comment Content */}
      <div className="mb-3">
        {isEditing ? (
          <CommentForm
            mode="edit"
            commentId={comment.id}
            initialContent={comment.content}
            initialContentType={comment.content_type}
            onSubmit={handleEditSubmit}
            onCancel={() => setIsEditing(false)}
            showCancel={true}
            placeholder="Edit your comment..."
            className="border-0 p-0 bg-transparent"
          />
        ) : (
          renderContent()
        )}
      </div>

      {/* Media Attachments */}
      {comment.media_attachments && comment.media_attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {comment.media_attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-sm"
            >
              <span className="text-gray-600">📎</span>
              <a
                href={attachment.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 truncate max-w-[200px]"
              >
                {attachment.filename}
              </a>
              <span className="text-gray-400 text-xs">
                ({Math.round(attachment.file_size / 1024)}KB)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Reply Form */}
      {isReplying && (
        <div className="mt-3">
          <CommentForm
            mode="create"
            taskId={comment.task_id}
            parentCommentId={comment.id}
            onSubmit={handleReplySubmit}
            onCancel={() => setIsReplying(false)}
            showCancel={true}
            placeholder="Write a reply..."
            autoFocus={true}
            className="bg-gray-50"
          />
        </div>
      )}

      {/* Replies */}
      {showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onReply={onReply}
              level={level + 1}
              showReplies={level < maxLevel - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
