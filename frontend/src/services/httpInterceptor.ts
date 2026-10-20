/**
 * @fileoverview HTTP Interceptor for TaaskMaaster
 * @description Enhanced HTTP interceptor with robust token management, retry logic, and error handling
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { tokenManager } from './tokenManager';

/**
 * @description Request retry configuration
 */
interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition: (error: AxiosError) => boolean;
}

/**
 * @description HTTP interceptor class
 */
export class HttpInterceptor {
  private static instance: HttpInterceptor;
  private axiosInstance: AxiosInstance;
  private requestQueue: Array<() => void> = [];
  private isRefreshing = false;

  /**
   * @description Get singleton instance
   */
  public static getInstance(): HttpInterceptor {
    if (!HttpInterceptor.instance) {
      HttpInterceptor.instance = new HttpInterceptor();
    }
    return HttpInterceptor.instance;
  }

  /**
   * @description Initialize HTTP interceptor
   */
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/proxy',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
    this.setupTokenEventListeners();
  }

  /**
   * @description Get axios instance
   */
  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }

  /**
   * @description Setup request interceptor
   */
  private setupRequestInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Skip auth for certain endpoints
        if (this.isAuthEndpoint(config.url)) {
          return config;
        }

        // Get current token - let 401 handling deal with invalid tokens
        const token = tokenManager.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          console.warn('⚠️  No token available for request:', config.url);
        }

        // Add request timestamp for monitoring
        (config as any).metadata = { startTime: Date.now() };

        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * @description Setup response interceptor
   */
  private setupResponseInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log successful response time
        if ((response.config as any).metadata?.startTime) {
          const duration = Date.now() - (response.config as any).metadata.startTime;
          if (duration > 5000) { // Log slow requests
            console.warn(`🐌 Slow request: ${response.config.url} took ${duration}ms`);
          }
        }

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

        // Handle 401 Unauthorized errors
        if (error.response?.status === 401 && !this.isAuthEndpoint(originalRequest.url)) {
          return this.handle401Error(originalRequest, error);
        }

        // Handle network errors with retry
        if (this.isNetworkError(error) && this.shouldRetry(originalRequest)) {
          return this.retryRequest(originalRequest, error);
        }

        // Handle server errors (5xx) with retry
        if (this.isServerError(error) && this.shouldRetry(originalRequest)) {
          return this.retryRequest(originalRequest, error);
        }

        // Log error for monitoring
        this.logError(error);

        return Promise.reject(error);
      }
    );
  }

  /**
   * @description Handle 401 authentication errors
   */
  private async handle401Error(
    originalRequest: AxiosRequestConfig & { _retry?: boolean },
    error: AxiosError
  ): Promise<AxiosResponse> {
    // Avoid infinite retry loops
    if (originalRequest._retry) {
      console.error('❌ Authentication failed after retry, forcing logout');
      this.forceLogout();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // If already refreshing, queue this request
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push(() => {
          const token = tokenManager.getAccessToken();
          if (token && originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(this.axiosInstance(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    // Attempt token refresh
    this.isRefreshing = true;

    try {
      const refreshResult = await tokenManager.refreshTokens();
      
      if (refreshResult.success) {

        
        // Process queued requests
        this.processRequestQueue();
        
        // Retry original request with new token
        const newToken = tokenManager.getAccessToken();
        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        
        return this.axiosInstance(originalRequest);
      } else {
        console.error('❌ Token refresh failed:', refreshResult.error);
        
        if (refreshResult.shouldLogout) {
          this.forceLogout();
        }
        
        this.clearRequestQueue();
        return Promise.reject(error);
      }
    } catch (refreshError) {
      console.error('❌ Token refresh error:', refreshError);
      this.forceLogout();
      this.clearRequestQueue();
      return Promise.reject(error);
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * @description Retry request with exponential backoff
   */
  private async retryRequest(
    originalRequest: AxiosRequestConfig & { _retryCount?: number },
    error: AxiosError
  ): Promise<AxiosResponse> {
    const retryCount = originalRequest._retryCount || 0;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    if (retryCount >= maxRetries) {
      console.error(`❌ Request failed after ${maxRetries} retries:`, originalRequest.url);
      return Promise.reject(error);
    }

    originalRequest._retryCount = retryCount + 1;

    // Exponential backoff: 1s, 2s, 4s
    const delay = baseDelay * Math.pow(2, retryCount);
    

    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.axiosInstance(originalRequest);
  }

  /**
   * @description Process queued requests after token refresh
   */
  private processRequestQueue(): void {
    this.requestQueue.forEach(processRequest => processRequest());
    this.requestQueue = [];
  }

  /**
   * @description Clear queued requests
   */
  private clearRequestQueue(): void {
    this.requestQueue = [];
  }

  /**
   * @description Force logout by clearing tokens and redirecting
   */
  private forceLogout(): void {
    tokenManager.clearTokens();
    
    // Emit custom event for app-wide logout handling
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('forceLogout', {
          detail: { reason: 'Authentication failed' }
        }));
      } catch (error) {
        console.error('Failed to dispatch forceLogout event:', error);
      }
    }
  }

  /**
   * @description Setup token event listeners
   */
  private setupTokenEventListeners(): void {
    tokenManager.addEventListener('expired', () => {
      // Token expired event - handled automatically by TokenManager
    });

    tokenManager.addEventListener('refreshed', () => {
      // Token refreshed event - handled automatically by TokenManager
    });

    tokenManager.addEventListener('invalid', () => {
      // Invalid token event - force logout
      this.forceLogout();
    });

    tokenManager.addEventListener('revoked', () => {
      // Token revoked event - handled automatically by TokenManager
    });
  }

  /**
   * @description Check if URL is an auth endpoint that doesn't need token
   */
  private isAuthEndpoint(url?: string): boolean {
    if (!url) return false;
    
    // Only login and refresh don't need authentication tokens
    // logout DOES need authentication
    const noAuthEndpoints = ['/auth/login', '/auth/refresh'];
    return noAuthEndpoints.some(endpoint => url.includes(endpoint));
  }

  /**
   * @description Check if error is a network error
   */
  private isNetworkError(error: AxiosError): boolean {
    return !error.response && (error.code === 'ECONNABORTED' || error.message === 'Network Error');
  }

  /**
   * @description Check if error is a server error (5xx)
   */
  private isServerError(error: AxiosError): boolean {
    return error.response?.status ? error.response.status >= 500 : false;
  }

  /**
   * @description Check if request should be retried
   */
  private shouldRetry(config: AxiosRequestConfig & { _retryCount?: number }): boolean {
    const retryCount = config._retryCount || 0;
    const maxRetries = 3;
    
    // Don't retry auth endpoints (login, refresh)
    if (this.isAuthEndpoint(config.url)) {
      return false;
    }

    // Don't retry logout specifically
    if (config.url?.includes('/auth/logout')) {
      return false;
    }

    // Don't retry POST/PUT/DELETE by default (unless explicitly configured)
    if (['post', 'put', 'delete'].includes(config.method?.toLowerCase() || '')) {
      return false;
    }

    return retryCount < maxRetries;
  }

  /**
   * @description Log error for monitoring
   */
  private logError(error: AxiosError): void {
    const { config, response } = error;
    
    console.error('❌ HTTP Error:', {
      url: config?.url,
      method: config?.method?.toUpperCase(),
      status: response?.status,
      statusText: response?.statusText,
      message: error.message,
      // Include response data for debugging (be careful with sensitive data)
      data: response?.data,
    });

    // In production, you might want to send this to an error monitoring service
    // like Sentry, LogRocket, or your own logging endpoint
  }
}

/**
 * @description Export singleton instance
 */
export const httpInterceptor = HttpInterceptor.getInstance();
