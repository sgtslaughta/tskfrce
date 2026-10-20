/**
 * @fileoverview API Proxy Routes
 * @description Proxies all API calls to backend, handling authentication and CORS
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Dynamic API proxy handler
 * Forwards all /api/proxy/* requests to the backend
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { path } = req.query;
  
  // Build the backend URL
  const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:8000';
  const apiPath = Array.isArray(path) ? path.join('/') : path;
  const targetUrl = `${backendUrl}/api/v1/${apiPath}`;

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Don't set Host header - let fetch use the URL's host automatically
  };

  // Forward authorization header if present
  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  // Forward cookies for session management
  if (req.headers.cookie) {
    headers.Cookie = req.headers.cookie;
  }

  // Forward other important headers
  if (req.headers['user-agent']) {
    headers['User-Agent'] = req.headers['user-agent'];
  }

  // Forward X-User-Data header for notifications API
  if (req.headers['x-user-data']) {
    const userData = req.headers['x-user-data'];
    headers['X-User-Data'] = Array.isArray(userData) ? userData[0] : userData;
  }

  try {
    console.log(`[API Proxy] ${req.method} ${targetUrl}`);
    console.log(`[API Proxy] Headers:`, headers);
    
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Add body for POST/PUT/PATCH requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    
    // Forward response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      // Don't forward these headers as they can cause issues
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // Set response headers
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Get response data
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Forward status and data
    res.status(response.status);
    
    if (contentType?.includes('application/json')) {
      res.json(data);
    } else {
      res.send(data);
    }

  } catch (error) {
    console.error('[API Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error instanceof Error ? error.message : 'Unknown error',
      target: targetUrl
    });
  }
}

// Enable body parsing for POST requests
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}