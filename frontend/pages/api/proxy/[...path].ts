/**
 * Proxies /api/proxy/* to the backend's /api/v1/*, passing bodies (JSON or
 * multipart) and responses (JSON or binary images) through byte for byte.
 */

import { NextApiRequest, NextApiResponse } from 'next'

const PASS_REQ = ['authorization', 'cookie', 'content-type', 'user-agent', 'accept']
const DROP_RES = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']

// uploads are capped at 10 MB by the backend (MAX_UPLOAD_SIZE); leave room for multipart framing
const MAX_BODY = 12 * 1024 * 1024

class TooLarge extends Error {}

async function rawBody(req: NextApiRequest): Promise<Buffer> {
  if (Number(req.headers['content-length'] || 0) > MAX_BODY) throw new TooLarge()
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req) {
    const b = typeof c === 'string' ? Buffer.from(c) : (c as Buffer)
    size += b.length
    if (size > MAX_BODY) {
      req.destroy()
      throw new TooLarge()
    }
    chunks.push(b)
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:8000'
  // keep the query string (?before=, ?kid=…); strip the /api/proxy prefix
  const rest = (req.url || '').replace(/^\/api\/proxy\/?/, '')
  if (rest.split('?')[0].split('/').some((seg) => seg === '..' || seg === '.' || /%2e/i.test(seg))) {
    res.status(400).json({ detail: 'Bad request.' })
    return
  }
  const targetUrl = `${backendUrl}/api/v1/${rest}`

  const headers: Record<string, string> = {}
  for (const h of PASS_REQ) {
    const v = req.headers[h]
    if (typeof v === 'string') headers[h] = v
  }
  // Real client IP for the backend (kid device lookup, rate limits). Built from the
  // socket only; client-sent x-real-ip / x-forwarded-for / forwarded are never copied.
  const peer = (req.socket.remoteAddress || '').replace(/^::ffff:/, '')
  if (peer) headers['X-Real-IP'] = peer

  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await rawBody(req)
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body && body.length ? new Uint8Array(body) : undefined,
    })
    response.headers.forEach((value, key) => {
      if (!DROP_RES.includes(key.toLowerCase())) res.setHeader(key, value)
    })
    res.status(response.status)
    if ([204, 205, 304].includes(response.status)) {
      res.end()
      return
    }
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    if (error instanceof TooLarge) {
      res.status(413).json({ detail: 'That file is too big. Try one under 8 MB.' })
      return
    }
    console.error('[API Proxy] Error:', error)
    res.status(502).json({ detail: "Can't reach the home box. Check it's plugged in and on Wi-Fi." })
  }
}

// raw bodies: multipart uploads must not be parsed or re-encoded
export const config = { api: { bodyParser: false } }
