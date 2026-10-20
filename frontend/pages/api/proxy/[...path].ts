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

  // Real client IP for the backend (kid device lookup, rate limits). Built from the
  // socket only; client-sent x-real-ip / x-forwarded-for / forwarded are never copied.
  const peer = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (peer) {
    headers['X-Real-IP'] = peer;
  }

  // Forward other important headers
  if (req.headers['user-agent']) {
    headers['User-Agent'] = req.headers['user-agent'];
  }


  try {
    console.log(`[API Proxy] ${req.method} ${targetUrl}`);
    
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

    // Empty-bodied statuses and empty bodies must not be parsed
    res.status(response.status);
    if ([204, 205, 304].includes(response.status)) {
      res.end();
      return;
    }
    const text = await response.text();
    if (!text) {
      res.end();
      return;
    }
    try {
      res.json(JSON.parse(text));
    } catch {
      res.send(text);
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