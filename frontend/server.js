/**
 * @fileoverview Custom Next.js Server with WebSocket Proxy
 * @description Handles both HTTP and WebSocket proxying to backend
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { createProxyMiddleware } = require('http-proxy-middleware');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle SIGBUS and other signals
process.on('SIGBUS', (signal) => {
  console.error('Received SIGBUS signal, exiting gracefully');
  process.exit(1);
});

// Initialize Next.js app with error handling
console.log('Initializing Next.js app...');
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log('Preparing Next.js app...');
app.prepare()
  .then(() => {
    console.log('Next.js app prepared successfully, creating server...');
    
    const server = createServer((req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        
        // Handle WebSocket upgrade requests
        if (req.url.startsWith('/ws/')) {
          // This will be handled by the upgrade listener below
          return;
        }
        
        // Handle all other requests with Next.js
        handle(req, res, parsedUrl);
      } catch (error) {
        console.error('Error handling request:', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    // WebSocket proxy configuration
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:8000';
    console.log('[WebSocket Proxy] Backend target:', backendUrl);
    
    const wsProxy = createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying
      logLevel: 'debug', // More verbose logging for debugging
      secure: false,
      timeout: 30000,
      onError: (err, req, res) => {
        console.error('[WebSocket Proxy] Error:', err.message, err.stack);
        if (res && !res.headersSent) {
          res.status(500).send('WebSocket proxy error');
        }
      },
      onProxyReqWs: (proxyReq, req, socket, options, head) => {
        console.log('[WebSocket Proxy] Proxying WebSocket upgrade to:', options.target.href + req.url);
        console.log('[WebSocket Proxy] Request headers:', req.headers);
        console.log('[WebSocket Proxy] Proxy request headers:', proxyReq.headers);
      },
      onOpen: (proxySocket) => {
        console.log('[WebSocket Proxy] Connection opened successfully to backend');
      },
      onClose: (res, socket, head) => {
        console.log('[WebSocket Proxy] Connection closed from backend');
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('[WebSocket Proxy] Response from backend:', proxyRes.statusCode);
      },
    });

    // Handle WebSocket upgrade requests
    server.on('upgrade', (req, socket, head) => {
      try {
        if (req.url.startsWith('/ws/')) {
          console.log('[WebSocket Proxy] Handling upgrade for:', req.url);
          
          // Try direct WebSocket proxy instead of middleware
          const http = require('http');
          const backendUrlObj = new URL(backendUrl);
          const proxyReq = http.request({
            hostname: backendUrlObj.hostname,
            port: backendUrlObj.port,
            path: req.url,
            method: req.method,
            headers: req.headers
          });
          
          proxyReq.on('upgrade', (res, proxySocket, proxyHead) => {
            console.log('[WebSocket Proxy] Backend upgrade response:', res.statusCode);
            socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                        'Upgrade: websocket\r\n' +
                        'Connection: Upgrade\r\n' +
                        '\r\n');
            
            proxySocket.pipe(socket);
            socket.pipe(proxySocket);
          });
          
          proxyReq.on('error', (err) => {
            console.error('[WebSocket Proxy] Backend connection error:', err);
            socket.destroy();
          });
          
          proxyReq.end();
        } else if (req.url.includes('/_next/webpack-hmr')) {
          // Handle Next.js HMR WebSocket connections
          console.log('[HMR WebSocket] Next.js HMR connection attempt - allowing');
          // Don't destroy HMR connections, let them pass through
        } else {
          console.log('[WebSocket] Unknown WebSocket connection, destroying:', req.url);
          socket.destroy();
        }
      } catch (error) {
        console.error('[WebSocket] Error handling upgrade:', error);
        socket.destroy();
      }
    });

    console.log('Starting server...');
    server.listen(port, hostname, (err) => {
      if (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
      }
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Backend URL: ${process.env.BACKEND_INTERNAL_URL || 'http://backend:8000'}`);
      console.log('> Server is ready to accept connections');
    });

    // Handle server errors
    server.on('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Failed to prepare Next.js app:', err);
    process.exit(1);
  });