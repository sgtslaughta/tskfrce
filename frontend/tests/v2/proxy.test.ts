import { test, expect, beforeEach } from '@jest/globals';
import handler from '../../pages/api/proxy/[...path]';

function fakeResp(status: number, body: string, ct: string | null) {
  return {
    status,
    headers: { get: () => ct, forEach: (cb: any) => ct && cb(ct, 'content-type') },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

function mockRes() {
  const res: any = { headers: {} };
  res.setHeader = jest.fn((k: string, v: string) => { res.headers[k] = v; });
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.end = jest.fn(() => res);
  return res;
}
const req: any = { method: 'DELETE', query: { path: ['chores', '1'] }, headers: {}, socket: {} };

beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });

test('204 with json content-type ends with no body', async () => {
  (global as any).fetch = jest.fn(async () => fakeResp(204, '', 'application/json'));
  const res = mockRes();
  await handler(req, res);
  expect(res.status).toHaveBeenCalledWith(204);
  expect(res.end).toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
  expect(res.send).not.toHaveBeenCalled();
});

test('json body is still forwarded', async () => {
  (global as any).fetch = jest.fn(async () => fakeResp(200, '{"a":1}', 'application/json'));
  const res = mockRes();
  await handler({ ...req, method: 'GET' }, res);
  expect(res.json).toHaveBeenCalledWith({ a: 1 });
});

test('empty 200 body ends cleanly', async () => {
  (global as any).fetch = jest.fn(async () => fakeResp(200, '', 'application/json'));
  const res = mockRes();
  await handler({ ...req, method: 'GET' }, res);
  expect(res.end).toHaveBeenCalled();
});
