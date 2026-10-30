import { test, expect, beforeEach } from '@jest/globals';
import handler from '../../pages/api/proxy/[...path]';

function fakeResp(status: number, body: string, ct: string | null) {
  return {
    status,
    headers: { forEach: (cb: any) => ct && cb(ct, 'content-type') },
    arrayBuffer: async () => Uint8Array.from(Buffer.from(body)).buffer,
  };
}

function mockRes() {
  const res: any = { headers: {} };
  res.setHeader = jest.fn((k: string, v: string) => { res.headers[k] = v; });
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}

function mockReq(method: string, url: string, body = '', headers: Record<string, string> = {}): any {
  const chunks = body ? [Buffer.from(body)] : [];
  return {
    method,
    url,
    headers,
    socket: { remoteAddress: '::ffff:10.0.0.7' },
    destroy: jest.fn(),
    async *[Symbol.asyncIterator]() { yield* chunks; },
  };
}

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });

test('204 ends with no body', async () => {
  (global as any).fetch = jest.fn(async () => fakeResp(204, '', 'application/json'));
  const res = mockRes();
  await handler(mockReq('DELETE', '/api/proxy/chores/1'), res);
  expect(res.status).toHaveBeenCalledWith(204);
  expect(res.end).toHaveBeenCalledWith();
});

test('body bytes, content-type and query string pass through', async () => {
  const fetch = jest.fn(async () => fakeResp(200, '{"a":1}', 'application/json'));
  (global as any).fetch = fetch;
  const res = mockRes();
  const ct = 'multipart/form-data; boundary=x';
  await handler(mockReq('POST', '/api/proxy/chat/threads/1/photos?before=5', '--x--', { 'content-type': ct }), res);
  const [url, init] = fetch.mock.calls[0] as any;
  expect(url).toMatch(/\/api\/v1\/chat\/threads\/1\/photos\?before=5$/);
  expect(init.headers['content-type']).toBe(ct);
  expect(init.headers['X-Real-IP']).toBe('10.0.0.7');
  expect(Buffer.from(init.body).toString()).toBe('--x--');
  expect(res.headers['content-type']).toBe('application/json');
  expect(Buffer.from(res.end.mock.calls[0][0]).toString()).toBe('{"a":1}');
});

test('client-sent x-forwarded-for is not copied', async () => {
  const fetch = jest.fn(async () => fakeResp(200, '', null));
  (global as any).fetch = fetch;
  await handler(mockReq('GET', '/api/proxy/kid/today', '', { 'x-forwarded-for': '1.2.3.4' }), mockRes());
  const [, init] = fetch.mock.calls[0] as any;
  expect(init.headers['x-forwarded-for']).toBeUndefined();
});

test('x-view-as passes through for parent preview', async () => {
  const fetch = jest.fn(async () => fakeResp(200, '', null));
  (global as any).fetch = fetch;
  await handler(mockReq('GET', '/api/proxy/kid/today', '', { 'x-view-as': '2' }), mockRes());
  const [, init] = fetch.mock.calls[0] as any;
  expect(init.headers['x-view-as']).toBe('2');
});

test('oversized body is refused with 413', async () => {
  (global as any).fetch = jest.fn();
  const res = mockRes();
  await handler(mockReq('POST', '/api/proxy/chat/threads/1/photos', '', { 'content-length': String(13 * 1024 * 1024) }), res);
  expect(res.status).toHaveBeenCalledWith(413);
  expect((global as any).fetch).not.toHaveBeenCalled();
});

test('dot segments are refused', async () => {
  (global as any).fetch = jest.fn();
  const res = mockRes();
  await handler(mockReq('GET', '/api/proxy/chat/../internal/state'), res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect((global as any).fetch).not.toHaveBeenCalled();
});

test('forwards bearer auth but never browser cookies', async () => {
  const fetchMock = jest.fn(async (..._a: any[]) => fakeResp(200, '{}', 'application/json'));
  (global as any).fetch = fetchMock;
  await handler(mockReq('GET', '/api/proxy/today', '', { authorization: 'Bearer t', cookie: 'task4ce_user=x' }), mockRes());
  const sent = (fetchMock.mock.calls[0] as any[])[1].headers;
  expect(sent.authorization).toBe('Bearer t');
  expect(sent.cookie).toBeUndefined();
});
