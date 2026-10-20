/**
 * @fileoverview Comment Form component for TaaskMaaster
 * @description Form component for creating and editing task comments
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState, useRef } from 'react';
import { Button } from '../../design-system/components/Button';
import { cn } from '../../design-system/utils/cn';
import { commentService, CommentCreate, CommentUpdate } from '../../services/commentService';

/**
 * @description Comment form props interface
 */
interface CommentFormProps {
  taskId?: number;
  parentCommentId?: number;
  initialContent?: string;
  initialContentType?: 'text' | 'markdown' | 'html';
  mode: 'create' | 'edit';
  commentId?: number;
  onSubmit?: (comment: any) => void;
  onCancel?: () => void;
  className?: string;
  placeholder?: string;
  showCancel?: boolean;
  autoFocus?: boolean;
}

/**
 * @description Comment Form Component
 * @param props - Component props
 * @returns JSX.Element
 */
export const CommentForm: React.FC<CommentFormProps> = ({
  taskId,
  parentCommentId,
  initialContent = '',
  initialContentType = 'markdown',
  mode,
  commentId,
  onSubmit,
  onCancel,
  className,
  placeholder = 'Write a comment...',
  showCancel = false,
  autoFocus = false,
}) => {
  const [content, setContent] = useState(initialContent);
  const [contentType, setContentType] = useState<'text' | 'markdown' | 'html'>(initialContentType || 'markdown');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaAttachments, setMediaAttachments] = useState<number[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Comment content is required');
      return;
    }

    if (mode === 'create' && !taskId) {
      setError('Task ID is required for creating comments');
      return;
    }

    if (mode === 'edit' && !commentId) {
      setError('Comment ID is required for editing');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let result;

      if (mode === 'create') {
        const createData: CommentCreate = {
          task_id: taskId!,
          content: content.trim(),
          content_type: contentType,
          parent_comment_id: parentCommentId,
          media_attachment_ids: mediaAttachments.length > 0 ? mediaAttachments : undefined,
        };
        result = await commentService.createComment(createData);
      } else {
        const updateData: CommentUpdate = {
          content: content.trim(),
          content_type: contentType,
        };
        result = await commentService.updateComment(commentId!, updateData);
      }

      onSubmit?.(result);
      
      // Reset form if creating a new comment
      if (mode === 'create') {
        setContent('');
        setMediaAttachments([]);
      }
    } catch (err: any) {
      console.error('Error submitting comment:', err);
      setError(err.response?.data?.detail || 'Failed to submit comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle cancel action
   */
  const handleCancel = () => {
    setContent(initialContent);
    setContentType(initialContentType || 'markdown');
    setError(null);
    onCancel?.();
  };

  /**
   * Auto-resize textarea
   */
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit with Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'space-y-3 p-4 border rounded-lg bg-white',
        'border-gray-200 focus-within:border-blue-300',
        className
      )}
    >
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {/* Content Type Selector */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">Format:</span>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              value="markdown"
              checked={contentType === 'markdown'}
              onChange={(e) => setContentType(e.target.value as 'text' | 'markdown' | 'html')}
              className="text-blue-600"
            />
            <span>Markdown</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              value="text"
              checked={contentType === 'text'}
              onChange={(e) => setContentType(e.target.value as 'text' | 'markdown' | 'html')}
              className="text-blue-600"
            />
            <span>Plain Text</span>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              value="html"
              checked={contentType === 'html'}
              onChange={(e) => setContentType(e.target.value as 'text' | 'markdown' | 'html')}
              className="text-blue-600"
            />
            <span>HTML</span>
          </label>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={isSubmitting}
          className={cn(
            'w-full min-h-[100px] p-3 border rounded-md resize-none',
            'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200',
            'placeholder-gray-400 text-gray-900',
            'disabled:bg-gray-50 disabled:cursor-not-allowed',
            'transition-colors duration-200'
          )}
          rows={3}
        />

        {/* Markdown help text */}
        {contentType === 'markdown' && (
          <div className="text-xs text-gray-500">
            Supports **bold**, *italic*, `code`, and [links](url). Use Ctrl+Enter to submit.
          </div>
        )}
      </div>

      {/* Media Attachments Section - Placeholder for now */}
      {mediaAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mediaAttachments.map((attachmentId) => (
            <div
              key={attachmentId}
              className="flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm"
            >
              <span>Attachment {attachmentId}</span>
              <button
                type="button"
                onClick={() => setMediaAttachments(prev => prev.filter(id => id !== attachmentId))}
                className="text-blue-500 hover:text-blue-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Media Upload Button - Placeholder */}
          <button
            type="button"
            disabled={isSubmitting}
            className={cn(
              'px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded',
              'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            📎 Attach
          </button>
        </div>

        <div className="flex items-center gap-2">
          {showCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting || !content.trim()}
          >
            {isSubmitting ? 'Submitting...' : mode === 'create' ? 'Comment' : 'Update'}
          </Button>
        </div>
      </div>
    </form>
  );
};
