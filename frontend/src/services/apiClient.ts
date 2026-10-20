/**
 * @fileoverview API Client Export for TaaskMaaster Services
 * @description Re-exports the main API client for use in service files
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { 
  api, 
  apiGet, 
  apiPost, 
  apiPut, 
  apiDelete, 
  apiPatch, 
  apiUpload,
  apiRequest,
  checkApiHealth,
  invalidateUserCache,
  type ApiResponse,
  type ApiError
} from './api';

/**
 * @description Main API client instance
 * Re-exported for use in service files
 */
export const apiClient = api;

/**
 * @description API helper functions
 * Re-exported for convenience
 */
export {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiPatch,
  apiUpload,
  apiRequest,
  checkApiHealth,
  invalidateUserCache,
  type ApiResponse,
  type ApiError
};

/**
 * @description Default export for backward compatibility
 */
export default apiClient;
