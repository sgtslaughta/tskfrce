/**
 * useSearch Hook
 * 
 * Custom hook for managing search state and performing searches
 * across comments and messages with advanced filtering.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

// Simple debounce implementation to avoid lodash type issues
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel(): void } => {
  let timeout: NodeJS.Timeout;
  const debouncedFunc = ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel(): void };
  
  debouncedFunc.cancel = () => {
    clearTimeout(timeout);
  };
  
  return debouncedFunc;
};

// Temporary SearchFilters interface (replaces disabled SearchFilterPanel)
interface SearchFilters {
  query: string;
  users: User[];
  dateRange: {
    start?: Date;
    end?: Date;
  };
  contentTypes: string[];
  hasAttachments?: boolean;
  hasReactions?: boolean;
  isEdited?: boolean;
  tags: string[];
  sortBy: 'newest' | 'oldest' | 'relevance';
  sortOrder: 'asc' | 'desc';
}
import { commentService } from '../services/commentService';
import { messagingService } from '../services/messagingService';
import { TaskComment } from '../types/comment';
import { DirectMessage, TaskChatMessage } from '../types/messaging';
import { User, UserRole, UserStatus, OnlineStatus } from '../types/user';

export interface SearchResult {
  comments: TaskComment[];
  directMessages: DirectMessage[];
  taskChatMessages: TaskChatMessage[];
  totalCount: number;
  hasMore: boolean;
}

export interface UseSearchOptions {
  /** Search scope */
  scope: 'comments' | 'messages' | 'all';
  /** Task ID for task-specific searches */
  taskId?: number;
  /** Conversation ID for conversation-specific searches */
  conversationId?: number;
  /** Results per page */
  pageSize?: number;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
}

export interface UseSearchReturn {
  /** Current search filters */
  filters: SearchFilters;
  /** Update search filters */
  setFilters: (filters: SearchFilters) => void;
  /** Search results */
  results: SearchResult;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: string | null;
  /** Current page */
  page: number;
  /** Load more results */
  loadMore: () => void;
  /** Reset search */
  reset: () => void;
  /** Perform search manually */
  search: () => void;
  /** Available filter options */
  filterOptions: {
    users: User[];
    contentTypes: string[];
    tags: string[];
  };
}

const defaultFilters: SearchFilters = {
  query: '',
  users: [],
  dateRange: {},
  contentTypes: [],
  hasAttachments: undefined,
  hasReactions: undefined,
  isEdited: undefined,
  tags: [],
  sortBy: 'newest',
  sortOrder: 'desc'
};

/**
 * useSearch provides comprehensive search functionality
 */
export const useSearch = (options: UseSearchOptions): UseSearchReturn => {
  const {
    scope = 'all',
    taskId,
    conversationId,
    pageSize = 20,
    debounceMs = 300
  } = options;

  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [results, setResults] = useState<SearchResult>({
    comments: [],
    directMessages: [],
    taskChatMessages: [],
    totalCount: 0,
    hasMore: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filterOptions, setFilterOptions] = useState({
    users: [] as User[],
    contentTypes: ['text', 'markdown', 'html'] as string[],
    tags: [] as string[]
  });

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce(async (searchFilters: SearchFilters, pageNum: number = 0) => {
      if (!searchFilters.query && Object.keys(searchFilters).every(key => 
        key === 'query' || key === 'sortBy' || key === 'sortOrder' || 
        !searchFilters[key as keyof SearchFilters] || 
        (Array.isArray(searchFilters[key as keyof SearchFilters]) && 
         (searchFilters[key as keyof SearchFilters] as any[]).length === 0)
      )) {
        // No filters applied, clear results
        setResults({
          comments: [],
          directMessages: [],
          taskChatMessages: [],
          totalCount: 0,
          hasMore: false
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchParams = {
          query: searchFilters.query,
          user_ids: searchFilters.users.map(u => u.id),
          content_types: searchFilters.contentTypes,
          has_attachments: searchFilters.hasAttachments,
          has_reactions: searchFilters.hasReactions,
          is_edited: searchFilters.isEdited,
          tags: searchFilters.tags,
          date_from: searchFilters.dateRange.start?.toISOString(),
          date_to: searchFilters.dateRange.end?.toISOString(),
          sort_by: searchFilters.sortBy,
          sort_order: searchFilters.sortOrder,
          page: pageNum,
          per_page: pageSize,
          task_id: taskId,
          conversation_id: conversationId
        };

        let newResults: SearchResult = {
          comments: [],
          directMessages: [],
          taskChatMessages: [],
          totalCount: 0,
          hasMore: false
        };

        // Search comments
        if ((scope === 'comments' || scope === 'all') && taskId !== undefined) {
          try {
            const currentTaskId = taskId; // TypeScript type guard
            const commentResults = await commentService.searchTaskComments({
              taskId: currentTaskId,
              query: searchParams.query,
              skip: searchParams.page ? (searchParams.page * searchParams.per_page) : undefined,
              limit: searchParams.per_page
            });
            
            // Transform Comment objects to TaskComment objects with default values for missing properties
            const transformedComments = commentResults.comments.map(comment => {
              // Transform the user object to match User interface
              const transformedUser: User = {
                id: comment.user.id,
                email: '', // Default empty string
                username: comment.user.username,
                first_name: comment.user.full_name?.split(' ')[0] || '',
                last_name: comment.user.full_name?.split(' ').slice(1).join(' ') || '',
                full_name: comment.user.full_name || '',
                role: 'user' as UserRole, // Default to user role
                status: 'active' as UserStatus, // Default to active status
                is_active: true, // Default to true
                is_verified: true, // Default to true
                avatar_url: comment.user.avatar_url,
                created_at: comment.created_at, // Use comment creation date as fallback
                updated_at: comment.updated_at, // Use comment update date as fallback
                last_login: undefined,
                profile: undefined,
                preferences: undefined,
                online_status: 'offline' as OnlineStatus, // Default to offline
                last_seen: undefined
              };

              return {
                ...comment,
                user: transformedUser,
                reply_count: comment.replies?.length || 0,
                is_system_generated: false, // Default value
                is_pinned: false, // Default value
                pinned_at: undefined,
                pinned_by_user_id: undefined,
                mentioned_users: [], // Default empty array
                reactions: [], // Default empty array
                edited_at: comment.is_edited ? comment.updated_at : undefined
              } as TaskComment;
            });
            
            newResults.comments = pageNum === 0 ? 
              transformedComments : 
              [...results.comments, ...transformedComments];
            newResults.totalCount += commentResults.total;
            newResults.hasMore = newResults.hasMore || (commentResults.comments.length === pageSize);
          } catch (err) {
            console.warn('Comment search failed:', err);
          }
        }

        // Search messages
        if (scope === 'messages' || scope === 'all') {
          try {
            // Search direct messages
            const directMessageResults = await messagingService.searchDirectMessages({
              ...searchParams,
              include_read_receipts: true
            });
            
            newResults.directMessages = pageNum === 0 ? 
              directMessageResults.messages : 
              [...results.directMessages, ...directMessageResults.messages];
            newResults.totalCount += directMessageResults.total;
            newResults.hasMore = newResults.hasMore || directMessageResults.has_more;

            // Search task chat messages
            const taskChatResults = await messagingService.searchTaskChatMessages({
              ...searchParams,
              include_mentions: true
            });
            
            newResults.taskChatMessages = pageNum === 0 ? 
              taskChatResults.messages : 
              [...results.taskChatMessages, ...taskChatResults.messages];
            newResults.totalCount += taskChatResults.total;
            newResults.hasMore = newResults.hasMore || taskChatResults.has_more;
          } catch (err) {
            console.warn('Message search failed:', err);
          }
        }

        setResults(newResults);
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, debounceMs),
    [scope, taskId, conversationId, pageSize, debounceMs, results]
  );

  // Perform search when filters change
  useEffect(() => {
    debouncedSearch(filters, 0);
    return () => {
      debouncedSearch.cancel();
    };
  }, [filters, debouncedSearch]);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Load users (this would typically come from a users service)
        // For now, we'll use an empty array or get from context
        const users: User[] = []; // TODO: Load from user service or context
        
        // Load available tags (from comments and messages)
        const tags: string[] = []; // TODO: Load from search service
        
        setFilterOptions({
          users,
          contentTypes: ['text', 'markdown', 'html'],
          tags
        });
      } catch (err) {
        console.warn('Failed to load filter options:', err);
      }
    };

    loadFilterOptions();
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && results.hasMore) {
      debouncedSearch(filters, page + 1);
    }
  }, [loading, results.hasMore, filters, page, debouncedSearch]);

  const reset = useCallback(() => {
    setFilters(defaultFilters);
    setResults({
      comments: [],
      directMessages: [],
      taskChatMessages: [],
      totalCount: 0,
      hasMore: false
    });
    setPage(0);
    setError(null);
  }, []);

  const search = useCallback(() => {
    debouncedSearch(filters, 0);
  }, [filters, debouncedSearch]);

  return {
    filters,
    setFilters,
    results,
    loading,
    error,
    page,
    loadMore,
    reset,
    search,
    filterOptions
  };
};

export default useSearch;
