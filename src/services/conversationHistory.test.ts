import { ensureConversation, restoreConversationIndex, restoreMessages } from './conversationHistory';
import { conversationsApi } from './api';
jest.mock('./api', () => ({ conversationsApi: { create: jest.fn() } }));
jest.mock('./nativeId', () => ({
  newClientId: () => '11111111-1111-4111-8111-111111111111',
  isCanonicalConversationId: (id: string) => /^[0-9a-f-]{36}$/.test(id),
}));
const id = '11111111-1111-4111-8111-111111111111';
const create = conversationsApi.create as jest.Mock;
beforeEach(() => create.mockReset());
test('fresh install restores account metadata without a cache', () => {
  expect(restoreConversationIndex([{ id, title: 'Saved', created_at: '2026-10-20T12:00:00Z', updated_at: '2026-10-20T12:00:00Z' }], []))
    .toEqual([{ id, title: 'Saved', createdAt: 1792497600000, updatedAt: 1792497600000, messages: [] }]);
});
test('server turns become ordered user and assistant messages', () => {
  const rows = ['user', 'assistant'].map(role => ({ id: `${id}:${role}`, role: role as 'user' | 'assistant', text: role, timestamp: '2026-10-20T12:00:00Z' }));
  expect(restoreMessages(rows).map(item => item.isUser)).toEqual([true, false]);
});
test('malformed server history is rejected rather than displayed', () => {
  expect(() => restoreMessages([{ id, text: 'x', role: 'user', timestamp: 'invalid' }])).toThrow();
});
test('legacy local IDs are not sent as UUID conversation identities', async () => {
  create.mockResolvedValue({ id });
  await expect(ensureConversation('owner', 'conv_123', 'Title')).resolves.toBe(id);
  expect(create).toHaveBeenCalledWith('owner', id, 'Title');
});
test('existing server thread is reused without repeated creates', async () => {
  await expect(ensureConversation('owner', id, 'Title')).resolves.toBe(id);
  expect(create).not.toHaveBeenCalled();
});
test('creation failure or mismatched readback stops the send preparation', async () => {
  create.mockResolvedValue({ id: 'wrong' });
  await expect(ensureConversation('owner', null, 'Title')).rejects.toThrow('identity mismatch');
  create.mockRejectedValue(new Error('offline'));
  await expect(ensureConversation('owner', null, 'Title')).rejects.toThrow('offline');
});
