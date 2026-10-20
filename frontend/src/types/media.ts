/**
 * Media Type Definitions
 * 
 * Type definitions for media attachments, file handling,
 * and storage management.
 */

import { User } from './user';

export interface MediaAttachment {
  id: number;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  thumbnail_path?: string;
  metadata?: MediaMetadata;
  uploaded_by_user_id: number;
  uploaded_by: User;
  is_public: boolean;
  download_count: number;
  storage_provider: 'local' | 'minio' | 's3' | 'gcs';
  storage_key: string;
  checksum: string;
  uploaded_at: string;
  expires_at?: string;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number; // for video/audio in seconds
  bitrate?: number;
  codec?: string;
  color_profile?: string;
  camera_make?: string;
  camera_model?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  taken_at?: string;
  [key: string]: any;
}

export interface MediaUploadResponse {
  media: MediaAttachment;
  upload_url?: string; // for direct upload to storage
  success: boolean;
  message?: string;
}

export interface MediaUploadProgress {
  file: File;
  uploaded_bytes: number;
  total_bytes: number;
  percentage: number;
  speed: number; // bytes per second
  estimated_remaining: number; // seconds
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface MediaPreview {
  id: number;
  media_id: number;
  size: 'thumbnail' | 'small' | 'medium' | 'large';
  width: number;
  height: number;
  file_size: number;
  file_path: string;
  generated_at: string;
}

export interface MediaFolder {
  id: number;
  name: string;
  description?: string;
  parent_folder_id?: number;
  parent_folder?: MediaFolder;
  created_by_user_id: number;
  created_by: User;
  is_public: boolean;
  media_count: number;
  total_size: number;
  created_at: string;
  updated_at: string;
}

export interface MediaTag {
  id: number;
  name: string;
  color: string;
  created_by_user_id: number;
  created_by: User;
  usage_count: number;
  created_at: string;
}

export interface MediaShare {
  id: number;
  media_id: number;
  media: MediaAttachment;
  shared_by_user_id: number;
  shared_by: User;
  shared_with_user_id?: number;
  shared_with_user?: User;
  share_token: string;
  expires_at?: string;
  download_limit?: number;
  download_count: number;
  is_password_protected: boolean;
  permissions: {
    can_download: boolean;
    can_view: boolean;
    can_share: boolean;
  };
  created_at: string;
}

export interface MediaComment {
  id: number;
  media_id: number;
  user_id: number;
  user: User;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface MediaVersion {
  id: number;
  media_id: number;
  version_number: number;
  filename: string;
  file_size: number;
  file_path: string;
  uploaded_by_user_id: number;
  uploaded_by: User;
  change_description?: string;
  is_current: boolean;
  created_at: string;
}

export interface MediaProcessingJob {
  id: number;
  media_id: number;
  job_type: 'thumbnail' | 'preview' | 'compression' | 'format_conversion' | 'metadata_extraction';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_percentage: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  result_data?: any;
}

export interface MediaSearchFilter {
  query?: string;
  mime_type?: string[];
  file_size_min?: number;
  file_size_max?: number;
  uploaded_date_from?: string;
  uploaded_date_to?: string;
  uploaded_by_user_id?: number;
  folder_id?: number;
  tags?: string[];
  has_thumbnail?: boolean;
  is_public?: boolean;
}

export interface MediaSearchResult {
  media: MediaAttachment;
  relevance_score: number;
  highlight_snippet?: string;
  matched_fields: string[];
}

export interface MediaStatistics {
  total_files: number;
  total_size: number;
  files_by_type: Array<{
    mime_type: string;
    count: number;
    total_size: number;
  }>;
  files_by_user: Array<{
    user: User;
    count: number;
    total_size: number;
  }>;
  upload_activity: Array<{
    date: string;
    upload_count: number;
    total_size: number;
  }>;
  storage_usage: {
    used_bytes: number;
    total_bytes: number;
    percentage_used: number;
  };
  popular_files: Array<{
    media: MediaAttachment;
    download_count: number;
  }>;
}

export interface MediaBulkOperation {
  operation: 'delete' | 'move' | 'copy' | 'tag' | 'untag' | 'share' | 'unshare';
  media_ids: number[];
  parameters?: {
    destination_folder_id?: number;
    tags?: string[];
    share_settings?: {
      expires_at?: string;
      download_limit?: number;
      password?: string;
    };
  };
}

export interface MediaBulkOperationResult {
  operation: string;
  success_count: number;
  failed_count: number;
  total_count: number;
  results: Array<{
    media_id: number;
    success: boolean;
    error?: string;
  }>;
  processing_time_ms: number;
}

// WebSocket events for media operations
export type MediaWebSocketEvent = 
  | 'media_upload_progress'
  | 'media_upload_completed'
  | 'media_upload_failed'
  | 'media_processing_started'
  | 'media_processing_completed'
  | 'media_processing_failed'
  | 'media_deleted'
  | 'media_shared'
  | 'media_comment_added';

export interface MediaWebSocketMessage {
  event: MediaWebSocketEvent;
  data: {
    media_id?: number;
    media?: MediaAttachment;
    user_id?: number;
    progress?: MediaUploadProgress;
    processing_job?: MediaProcessingJob;
    error?: string;
    timestamp: string;
    [key: string]: any;
  };
}
