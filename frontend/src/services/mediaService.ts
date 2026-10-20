/**
 * Media Service
 * 
 * Handles all media-related API calls including upload, download,
 * processing, and management operations.
 */

import { apiClient } from './apiClient';
import { MediaAttachment, MediaUploadResponse, MediaSearchResult, MediaStatistics } from '../types/media';

export interface UploadMediaRequest {
  file: File;
  context: 'comment' | 'message' | 'task_message' | 'profile' | 'general';
  folder_id?: number;
  tags?: string[];
  is_public?: boolean;
  description?: string;
}

export interface MediaQueryParams {
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  mime_type?: string[];
  folder_id?: number;
  tags?: string[];
  uploaded_by_user_id?: number;
  date_from?: string;
  date_to?: string;
  is_public?: boolean;
}

export interface MediaResponse {
  media: MediaAttachment[];
  total_count: number;
  has_more: boolean;
}

class MediaService {
  /**
   * Upload a media file
   */
  async uploadMedia(file: File, context: string, options?: {
    folder_id?: number;
    tags?: string[];
    is_public?: boolean;
    description?: string;
    onProgress?: (progress: number) => void;
  }): Promise<MediaUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', context);
    
    if (options?.folder_id) {
      formData.append('folder_id', options.folder_id.toString());
    }
    if (options?.tags) {
      formData.append('tags', JSON.stringify(options.tags));
    }
    if (options?.is_public !== undefined) {
      formData.append('is_public', options.is_public.toString());
    }
    if (options?.description) {
      formData.append('description', options.description);
    }

    const response = await apiClient.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (options?.onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(progress);
        }
      },
    });

    return response.data;
  }

  /**
   * Upload multiple media files
   */
  async uploadMultipleMedia(
    files: File[],
    context: string,
    options?: {
      folder_id?: number;
      tags?: string[];
      is_public?: boolean;
      onProgress?: (fileIndex: number, progress: number) => void;
    }
  ): Promise<{
    results: MediaUploadResponse[];
    success_count: number;
    failed_count: number;
  }> {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    
    formData.append('context', context);
    
    if (options?.folder_id) {
      formData.append('folder_id', options.folder_id.toString());
    }
    if (options?.tags) {
      formData.append('tags', JSON.stringify(options.tags));
    }
    if (options?.is_public !== undefined) {
      formData.append('is_public', options.is_public.toString());
    }

    const response = await apiClient.post('/media/upload/bulk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  /**
   * Get media by ID
   */
  async getMedia(mediaId: number): Promise<{ media: MediaAttachment }> {
    const response = await apiClient.get(`/media/${mediaId}`);
    return response.data;
  }

  /**
   * Get media list
   */
  async getMediaList(params?: MediaQueryParams): Promise<MediaResponse> {
    const response = await apiClient.get('/media', { params });
    return response.data;
  }

  /**
   * Get media URL for viewing/downloading
   */
  async getMediaUrl(mediaId: number, options?: {
    download?: boolean;
    thumbnail?: boolean;
    size?: 'small' | 'medium' | 'large';
  }): Promise<string> {
    const params = new URLSearchParams();
    if (options?.download) params.append('download', 'true');
    if (options?.thumbnail) params.append('thumbnail', 'true');
    if (options?.size) params.append('size', options.size);

    const response = await apiClient.get(`/media/${mediaId}/url?${params}`);
    return response.data.url;
  }

  /**
   * Download media file
   */
  async downloadMedia(mediaId: number, filename?: string): Promise<void> {
    const url = await this.getMediaUrl(mediaId, { download: true });
    
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Update media metadata
   */
  async updateMedia(mediaId: number, updates: {
    filename?: string;
    description?: string;
    tags?: string[];
    is_public?: boolean;
    folder_id?: number;
  }): Promise<{ media: MediaAttachment; success: boolean }> {
    const response = await apiClient.put(`/media/${mediaId}`, updates);
    return response.data;
  }

  /**
   * Delete media
   */
  async deleteMedia(mediaId: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/media/${mediaId}`);
    return response.data;
  }

  /**
   * Search media
   */
  async searchMedia(params: {
    query?: string;
    mime_type?: string[];
    file_size_min?: number;
    file_size_max?: number;
    uploaded_date_from?: string;
    uploaded_date_to?: string;
    uploaded_by_user_id?: number;
    folder_id?: number;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    results: MediaSearchResult[];
    total_count: number;
    search_time_ms: number;
  }> {
    const response = await apiClient.get('/media/search', { params });
    return response.data;
  }

  /**
   * Get media statistics
   */
  async getMediaStats(params?: {
    date_from?: string;
    date_to?: string;
    user_id?: number;
    folder_id?: number;
  }): Promise<MediaStatistics> {
    const response = await apiClient.get('/media/stats', { params });
    return response.data;
  }

  /**
   * Create media folder
   */
  async createFolder(folder: {
    name: string;
    description?: string;
    parent_folder_id?: number;
    is_public?: boolean;
  }): Promise<{
    folder: {
      id: number;
      name: string;
      description?: string;
      parent_folder_id?: number;
      is_public: boolean;
      created_at: string;
    };
    success: boolean;
  }> {
    const response = await apiClient.post('/media/folders', folder);
    return response.data;
  }

  /**
   * Get media folders
   */
  async getFolders(params?: {
    parent_folder_id?: number;
    include_media_count?: boolean;
  }): Promise<{
    folders: Array<{
      id: number;
      name: string;
      description?: string;
      parent_folder_id?: number;
      is_public: boolean;
      media_count?: number;
      created_at: string;
    }>;
  }> {
    const response = await apiClient.get('/media/folders', { params });
    return response.data;
  }

  /**
   * Update folder
   */
  async updateFolder(folderId: number, updates: {
    name?: string;
    description?: string;
    parent_folder_id?: number;
    is_public?: boolean;
  }): Promise<{ success: boolean }> {
    const response = await apiClient.put(`/media/folders/${folderId}`, updates);
    return response.data;
  }

  /**
   * Delete folder
   */
  async deleteFolder(folderId: number, options?: {
    move_media_to_folder_id?: number;
    delete_media?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete(`/media/folders/${folderId}`, {
      data: options
    });
    return response.data;
  }

  /**
   * Get media tags
   */
  async getTags(): Promise<{
    tags: Array<{
      id: number;
      name: string;
      color: string;
      usage_count: number;
    }>;
  }> {
    const response = await apiClient.get('/media/tags');
    return response.data;
  }

  /**
   * Create media tag
   */
  async createTag(tag: {
    name: string;
    color: string;
  }): Promise<{
    tag: {
      id: number;
      name: string;
      color: string;
    };
    success: boolean;
  }> {
    const response = await apiClient.post('/media/tags', tag);
    return response.data;
  }

  /**
   * Add tags to media
   */
  async addTagsToMedia(mediaId: number, tagIds: number[]): Promise<{ success: boolean }> {
    const response = await apiClient.post(`/media/${mediaId}/tags`, {
      tag_ids: tagIds
    });
    return response.data;
  }

  /**
   * Remove tags from media
   */
  async removeTagsFromMedia(mediaId: number, tagIds: number[]): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/media/${mediaId}/tags`, {
      data: { tag_ids: tagIds }
    });
    return response.data;
  }

  /**
   * Share media
   */
  async shareMedia(mediaId: number, shareSettings: {
    shared_with_user_id?: number;
    expires_at?: string;
    download_limit?: number;
    password?: string;
    permissions: {
      can_download: boolean;
      can_view: boolean;
      can_share: boolean;
    };
  }): Promise<{
    share: {
      id: number;
      share_token: string;
      share_url: string;
      expires_at?: string;
    };
    success: boolean;
  }> {
    const response = await apiClient.post(`/media/${mediaId}/share`, shareSettings);
    return response.data;
  }

  /**
   * Get media shares
   */
  async getMediaShares(mediaId?: number): Promise<{
    shares: Array<{
      id: number;
      media_id: number;
      media: MediaAttachment;
      share_token: string;
      shared_with_user?: {
        id: number;
        username: string;
        first_name?: string;
        last_name?: string;
      };
      expires_at?: string;
      download_count: number;
      created_at: string;
    }>;
  }> {
    const params = mediaId ? { media_id: mediaId } : {};
    const response = await apiClient.get('/media/shares', { params });
    return response.data;
  }

  /**
   * Revoke media share
   */
  async revokeShare(shareId: number): Promise<{ success: boolean }> {
    const response = await apiClient.delete(`/media/shares/${shareId}`);
    return response.data;
  }

  /**
   * Bulk operations
   */
  async bulkDeleteMedia(mediaIds: number[]): Promise<{
    success: boolean;
    deleted_count: number;
    failed_count: number;
    errors: string[];
  }> {
    const response = await apiClient.post('/media/bulk-delete', {
      media_ids: mediaIds
    });
    return response.data;
  }

  async bulkMoveMedia(mediaIds: number[], destinationFolderId: number): Promise<{
    success: boolean;
    moved_count: number;
    failed_count: number;
    errors: string[];
  }> {
    const response = await apiClient.post('/media/bulk-move', {
      media_ids: mediaIds,
      destination_folder_id: destinationFolderId
    });
    return response.data;
  }

  async bulkTagMedia(mediaIds: number[], tagIds: number[]): Promise<{
    success: boolean;
    tagged_count: number;
    failed_count: number;
    errors: string[];
  }> {
    const response = await apiClient.post('/media/bulk-tag', {
      media_ids: mediaIds,
      tag_ids: tagIds
    });
    return response.data;
  }

  /**
   * Generate media thumbnail
   */
  async generateThumbnail(mediaId: number, options?: {
    width?: number;
    height?: number;
    quality?: number;
  }): Promise<{
    thumbnail_url: string;
    success: boolean;
  }> {
    const response = await apiClient.post(`/media/${mediaId}/thumbnail`, options);
    return response.data;
  }

  /**
   * Get media processing status
   */
  async getProcessingStatus(mediaId: number): Promise<{
    jobs: Array<{
      id: number;
      job_type: string;
      status: string;
      progress_percentage: number;
      error_message?: string;
    }>;
  }> {
    const response = await apiClient.get(`/media/${mediaId}/processing`);
    return response.data;
  }

  /**
   * Export media list
   */
  async exportMediaList(params: {
    format: 'csv' | 'json' | 'xlsx';
    folder_id?: number;
    tags?: string[];
    date_from?: string;
    date_to?: string;
  }): Promise<{ download_url: string; expires_at: string }> {
    const response = await apiClient.post('/media/export', params);
    return response.data;
  }
}

export const mediaService = new MediaService();
