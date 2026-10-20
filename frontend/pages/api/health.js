/**
 * @fileoverview Health Check API Endpoint
 * @description Simple health check endpoint for Docker health monitoring
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

/**
 * @description Health check handler
 * @param {Object} req - Next.js request object
 * @param {Object} res - Next.js response object
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'taaskmaaster-frontend',
    version: process.env.npm_package_version || '1.0.0'
  });
}
