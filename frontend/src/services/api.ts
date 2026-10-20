/**
 * @fileoverview API Service Configuration for TaaskMaaster
 * @description Main API service setup with enhanced token management and error handling
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { httpInterceptor } from './httpInterceptor';

/**
 * @description API configuration interface
 */
interface ApiConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
}

/**
 * @description API error response interface
 */
export interface ApiError {
  detail: string;
  status_code: number;
  message?: string;
}

/**
 * @description API response wrapper interface
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

/**
 * @description Default API configuration
 */
const defaultConfig: ApiConfig = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/proxy',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * @description Get axios instance from HTTP interceptor
 */
const getApiInstance = (): AxiosInstance => {
  return httpInterceptor.getAxiosInstance();
};

/**
 * @description Main API instance
 */
export const api = getApiInstance();

/**
 * @description Generic API request function
 * @param config - Axios request configuration
 * @returns Promise with API response
 */
export const apiRequest = async <T = any>(
  config: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  try {
    const response = await api(config);
    return {
      data: response.data,
      status: response.status,
    };
  } catch (error: any) {
    const apiError: ApiError = {
      detail: error.response?.data?.detail || error.message || 'Unknown error',
      status_code: error.response?.status || 500,
      message: error.response?.data?.message,
    };
    throw apiError;
  }
};

/**
 * @description GET request helper
 * @param url - API endpoint URL
 * @param config - Additional request configuration
 * @returns Promise with API response
 */
export const apiGet = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiRequest<T>({ ...config, method: 'GET', url });
};

/**
 * @description POST request helper
 * @param url - API endpoint URL
 * @param data - Request data
 * @param config - Additional request configuration
 * @returns Promise with API response
 */
export const apiPost = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiRequest<T>({ ...config, method: 'POST', url, data });
};

/**
 * @description PUT request helper
 * @param url - API endpoint URL
 * @param data - Request data
 * @param config - Additional request configuration
 * @returns Promise with API response
 */
export const apiPut = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiRequest<T>({ ...config, method: 'PUT', url, data });
};

/**
 * @description DELETE request helper
 * @param url - API endpoint URL
 * @param config - Additional request configuration
 * @returns Promise with API response
 */
export const apiDelete = async <T = any>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiRequest<T>({ ...config, method: 'DELETE', url });
};

/**
 * @description PATCH request helper
 * @param url - API endpoint URL
 * @param data - Request data
 * @param config - Additional request configuration
 * @returns Promise with API response
 */
export const apiPatch = async <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  return apiRequest<T>({ ...config, method: 'PATCH', url, data });
};

/**
 * @description Upload file helper
 * @param url - API endpoint URL
 * @param file - File to upload
 * @param config - Additional request configuration
 * @returns Promise with API response
 */
export const apiUpload = async <T = any>(
  url: string,
  file: File,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> => {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<T>({
    ...config,
    method: 'POST',
    url,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * @description Check if API is available
 * @returns Promise with health status
 */
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await apiGet('/health');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

/**
 * @description Invalidate user cache to force fresh data loading
 * @param userId - User ID to invalidate cache for
 * @returns Promise with invalidation result
 */
export const invalidateUserCache = async (userId: number): Promise<ApiResponse<{ success: boolean; message: string }>> => {
  return apiPost(`/redis/cache/user/${userId}/invalidate`);
};

export default api;
