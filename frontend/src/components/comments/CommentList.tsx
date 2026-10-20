/**
 * @fileoverview Comment List component for TaaskMaaster
 * @description List component for displaying task comments with pagination
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../design-system/components/Button';
import { cn } from '../../design-system/utils/cn';
import { Comment, CommentListResponse, commentService } from '../../services/commentService';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';

/**
 * @description Comment list props interface
 */
interface CommentListProps {
  taskId: number;
  currentUserId?: number;
  className?: string;
  showNewCommentForm?: boolean;
  includeSystemComments?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * @description Comment List Component
 * @param props - Component props
 * @returns JSX.Element
 */
export const CommentList: React.FC<CommentListProps> = ({
  taskId,
  currentUserId,
  className,
  showNewCommentForm = true,
  includeSystemComments = true,
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  const limit = 20; // Comments per page

  /**
   * Load comments from the API
   */
  const loadComments = useCallback(async (skipCount = 0, append = false) => {
    try {
      if (!append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const response: CommentListResponse = await commentService.getTaskComments(
        taskId,
        {
          skip: skipCount,
          limit: limit,
          include_system: includeSystemComments
        }
      );

      const newComments = response.comments;
      setTotal(response.total);
      setHasMore(skipCount + newComments.length < response.total);

      if (append) {
        setComments(prev => [...prev, ...newComments]);
      } else {
        setComments(newComments);
      }
      
      setSkip(skipCount + newComments.length);
    } catch (err: any) {
      console.error('Error loading comments:', err);
      setError(err.response?.data?.detail || 'Failed to load comments');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [taskId, includeSystemComments, limit]);

  /**
   * Load more comments (pagination)
   */
  const loadMoreComments = () => {
    if (!isLoadingMore && hasMore) {
      loadComments(skip, true);
    }
  };

  /**
   * Refresh comments
   */
  const refreshComments = useCallback(() => {
    loadComments(0, false);
  }, [loadComments]);

  /**
   * Handle new comment submission
   */
  const handleNewComment = (newComment: Comment) => {
    // Add new comment to the beginning of the list
    setComments(prev => [newComment, ...prev]);
    setTotal(prev => prev + 1);
  };

  /**
   * Handle comment update
   */
  const handleCommentUpdate = (updatedComment: Comment) => {
    setComments(prev =>
      prev.map(comment =>
        comment.id === updatedComment.id ? updatedComment : comment
      )
    );
  };

  /**
   * Handle comment deletion
   */
  const handleCommentDelete = (commentId: number) => {
    setComments(prev => prev.filter(comment => comment.id !== commentId));
    setTotal(prev => prev - 1);
  };

  /**
   * Handle reply to comment
   */
  const handleCommentReply = (newReply: Comment) => {
    // Find parent comment and add reply
    setComments(prev =>
      prev.map(comment => {
        if (comment.id === newReply.parent_comment_id) {
          return {
            ...comment,
            replies: [...(comment.replies || []), newReply],
          };
        }
        return comment;
      })
    );
    setTotal(prev => prev + 1);
  };

  /**
   * Set up auto-refresh if enabled
   */
  useEffect(() => {
    if (autoRefresh) {
      const timer = setInterval(refreshComments, refreshInterval);
      setRefreshTimer(timer);
      
      return () => {
        clearInterval(timer);
      };
    }
  }, [autoRefresh, refreshInterval, refreshComments]);

  /**
   * Initial load
   */
  useEffect(() => {
    loadComments();
  }, [loadComments]);

  /**
   * Cleanup
   */
  useEffect(() => {
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [refreshTimer]);

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading comments...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="text-center py-8">
          <div className="text-red-600 mb-4">{error}</div>
          <Button
            variant="outline"
            onClick={() => loadComments()}
            disabled={isLoading}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Comments ({total})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshComments}
            disabled={isLoading}
            className="text-gray-600"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* New Comment Form */}
      {showNewCommentForm && (
        <CommentForm
          mode="create"
          taskId={taskId}
          onSubmit={handleNewComment}
          placeholder="Add a comment..."
          className="mb-6"
        />
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">💬</div>
          <p>No comments yet.</p>
          {showNewCommentForm && (
            <p className="text-sm">Be the first to add a comment!</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              onUpdate={handleCommentUpdate}
              onDelete={handleCommentDelete}
              onReply={handleCommentReply}
            />
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={loadMoreComments}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Loading more...
                  </>
                ) : (
                  `Load more comments (${total - comments.length} remaining)`
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="text-center text-xs text-gray-500">
          Auto-refreshing every {refreshInterval / 1000} seconds
        </div>
      )}
    </div>
  );
};
