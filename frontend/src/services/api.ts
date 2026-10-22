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

export default api;
