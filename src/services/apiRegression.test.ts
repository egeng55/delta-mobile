jest.mock('./supabase', () => ({ supabase: { auth: {
  getSession: jest.fn(async () => ({ data: { session: { access_token: 'fixture', expires_at: 9999999999 } } })),
  refreshSession: jest.fn(),
} } }));
import { chatApi, conversationsApi, exportApi } from './api';
import { TIMEOUTS } from '../config/constants';
const originalFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
test('text and image sends carry their durable thread and request identities', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ response: 'Fixture', saved: true }) });
  const turn = { conversationId: 'thread', requestId: 'turn' };
  await chatApi.sendMessage('owner', 'Hello', undefined, undefined, 'UTC', turn);
  await chatApi.sendMessageWithImage('owner', 'Photo', 'synthetic-image', 'UTC', undefined, undefined, undefined, turn);
  for (const [, options] of (fetch as jest.Mock).mock.calls) {
    expect(JSON.parse(options.body)).toMatchObject({ user_id: 'owner', conversation_id: 'thread', request_id: 'turn' });
    expect(options.headers.Authorization).toBe('Bearer fixture');
  }
});
test('history requests remain owner-scoped and paginated', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ messages: [], conversations: [] }) });
  await conversationsApi.getAll('owner', 100);
  await conversationsApi.getMessages('owner', 'thread', 50);
  expect((fetch as jest.Mock).mock.calls[0][0]).toContain('/conversations/owner?limit=100&offset=100');
  expect((fetch as jest.Mock).mock.calls[1][0]).toContain('/conversations/owner/thread/messages?limit=50&offset=50');
});
test('JSON response body deadline rejects without retrying account export POST', async () => {
  jest.useFakeTimers();
  let signal: AbortSignal | undefined;
  (fetch as jest.Mock).mockImplementation(async (_url, options) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  });
  const assertion = expect(exportApi.exportAccount('owner')).rejects.toMatchObject({ name: 'AbortError' });
  await jest.advanceTimersByTimeAsync(Math.max(TIMEOUTS.COLD_START, TIMEOUTS.NORMAL) + 1);
  await assertion;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(signal?.aborted).toBe(true);
});
test.each(['pdf', 'csv'] as const)('non-JSON %s body remains under deadline', async format => {
  jest.useFakeTimers();
  (fetch as jest.Mock).mockResolvedValue({ ok: true, blob: () => new Promise(() => {}), text: () => new Promise(() => {}) });
  const result = format === 'pdf' ? exportApi.exportPdf('owner') : exportApi.exportCsv('owner');
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await jest.advanceTimersByTimeAsync(Math.max(TIMEOUTS.COLD_START, TIMEOUTS.NORMAL) + 1);
  await assertion;
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('account export consumes and validates returned data', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: { fixture: true } }) });
  await expect(exportApi.exportAccount('owner')).resolves.toEqual({ fixture: true });
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ status: 'success' }) });
  await expect(exportApi.exportAccount('owner')).rejects.toThrow('Invalid account export');
});
