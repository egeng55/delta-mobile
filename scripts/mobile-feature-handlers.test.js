// Exercise the current screen handlers without a renderer or live services.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const chat = 'src/components/Chat/ChatBottomSheet.tsx';

function handler(file, name, bindings) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) expression = node.initializer.getText(tree);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!expression) throw new Error(`Missing handler ${name}`);
  const code = ts.transpileModule(`globalThis.run = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ Date, Promise, Error, Intl, ...bindings });
  vm.runInContext(code, context);
  return context.run;
}

function chatBindings() {
  const state = { messages: [], notice: null };
  const bindings = {
    user: { id: 'owner' }, operationRevision: { current: 1 }, accountRef: { current: 'owner' },
    sendInFlight: { current: false }, historyLoading: false, conversationIdRef: { current: null },
    unitSystem: 'metric', weatherData: null, CONVERSATIONS_STORAGE_KEY: 'history', CURRENT_CONVERSATION_KEY: 'current',
    newClientId: () => 'request-id', isCanonicalConversationId: id => id === 'server-thread',
    ensureConversation: jest.fn(async () => 'server-thread'),
    AsyncStorage: { setItem: jest.fn(async () => {}), getItem: jest.fn(async () => null) },
    chatApi: { sendMessage: jest.fn(async () => 'Reply'), sendMessageWithImage: jest.fn(async () => ({ response: 'Image reply', saved: true })) },
    FileSystem: { readAsStringAsync: jest.fn(async () => 'fixture-image') },
    setMessages: update => { state.messages = typeof update === 'function' ? update(state.messages) : update; },
    setHistoryNotice: value => { state.notice = value; },
    setCurrentConversationId: jest.fn(), setIsLoading: jest.fn(), setInputText: jest.fn(), setSelectedImage: jest.fn(),
    invalidateCache: jest.fn(),
  };
  return { bindings, state };
}

test('actual typed/voice send handler works without global crypto and binds durable IDs', async () => {
  const { bindings, state } = chatBindings();
  await handler(chat, 'sendChat', bindings)('Hello', null);
  expect(bindings.chatApi.sendMessage).toHaveBeenCalledWith('owner', 'Hello', 'metric', undefined, undefined,
    { conversationId: 'server-thread', requestId: 'request-id' });
  expect(state.messages.map(m => m.text)).toEqual(['Hello', 'Reply']);
  expect(bindings.sendInFlight.current).toBe(false);
});

test('synchronous send lock prevents duplicate taps before React state catches up', async () => {
  const { bindings } = chatBindings();
  let release;
  bindings.ensureConversation.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const send = handler(chat, 'sendChat', bindings);
  const first = send('Hello', null);
  await send('Hello', null);
  expect(bindings.ensureConversation).toHaveBeenCalledTimes(1);
  release('server-thread'); await first;
  expect(bindings.chatApi.sendMessage).toHaveBeenCalledTimes(1);
});

test('account switch during thread preparation cannot send or populate the new account', async () => {
  const { bindings, state } = chatBindings();
  let release;
  bindings.ensureConversation.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const sending = handler(chat, 'sendChat', bindings)('Hello', null);
  bindings.accountRef.current = 'other'; bindings.operationRevision.current++;
  release('server-thread'); await sending;
  expect(bindings.chatApi.sendMessage).not.toHaveBeenCalled();
  expect(bindings.AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(state.messages).toEqual([]);
});

test('native ID failure is shown without starting provider work', async () => {
  const { bindings, state } = chatBindings();
  bindings.newClientId = () => { throw new Error('unavailable'); };
  await handler(chat, 'sendChat', bindings)('Hello', null);
  expect(bindings.chatApi.sendMessage).not.toHaveBeenCalled();
  expect(state.notice).toContain('not confirmed');
  expect(bindings.sendInFlight.current).toBe(false);
});

test('image reply without durable acknowledgement is not represented as saved success', async () => {
  const { bindings, state } = chatBindings();
  bindings.chatApi.sendMessageWithImage.mockResolvedValue({ response: 'Unsaved' });
  await handler(chat, 'sendChat', bindings)('Caption', 'fixture://photo');
  expect(state.messages.some(m => !m.isUser)).toBe(false);
  expect(state.notice).toContain('not confirmed');
});

test('legacy cached messages are not mislabeled as part of the new durable thread', async () => {
  const { bindings, state } = chatBindings();
  bindings.conversationIdRef.current = 'conv_legacy';
  state.messages = [{ id: 'old', text: 'Local-only transcript' }];
  await handler(chat, 'sendChat', bindings)('New turn', null);
  expect(state.messages.map(m => m.text)).toEqual(['New turn', 'Reply']);
});

test('account export passes returned contents into the native share helper', async () => {
  let actions;
  const shareExport = jest.fn(async () => {});
  const run = handler('src/screens/SettingsScreen.tsx', 'handleExportData', {
    user: { id: 'owner' }, getLocalDateString: () => '2026-10-20', shareExport,
    exportApi: { exportAccount: jest.fn(async () => ({ fixture: true })) },
    Alert: { alert: (_title, _message, buttons) => { actions = buttons; } },
  });
  await run(); await actions.find(action => action.text === 'Export').onPress();
  expect(shareExport).toHaveBeenCalledWith('delta_account_2026-10-20.json', '{\n  "fixture": true\n}', 'application/json');
});

function deletionBindings(status, receipt) {
  return {
    user: { id: 'owner' }, API_BASE_URL: 'https://synthetic.invalid',
    setIsDeleting: jest.fn(), logout: jest.fn(), Alert: { alert: jest.fn() },
    supabase: { auth: { getSession: jest.fn(async () => ({ data: { session: { access_token: 'fixture' } } })) } },
    fetch: jest.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => receipt })),
  };
}

function scopedReceipt(status) {
  return { status, coverage: 'enumerated_application_scopes_only', whole_account_deleted: false,
    details: { status, coverage: 'enumerated_application_scopes_only', whole_account_deleted: false,
      remaining_actions: ['revoke_provider_authorizations', 'delete_auth_identity', 'review_other_application_stores', 'review_retained_copies_and_holds', 'private-untrusted-action'] } };
}

test.each([[409, 'scoped_deletion_complete', 'Deletion Needs Follow-up'], [503, 'partial', 'Deletion Incomplete']])(
  'scoped deletion %s shows remaining work without identity claims or logout', async (code, status, title) => {
    const bindings = deletionBindings(code, scopedReceipt(status));
    await handler('src/screens/SettingsScreen.tsx', 'executeAccountDeletion', bindings)();
    const [shownTitle, message] = bindings.Alert.alert.mock.calls[0];
    expect(shownTitle).toBe(title);
    expect(message).toContain('not been confirmed deleted');
    expect(message).toContain('Disconnect linked providers');
    expect(message).toContain('Complete account and session removal');
    expect(message).toContain('Review other app data');
    expect(message).toContain('Review retained copies');
    expect(message).not.toContain('private-untrusted-action');
    expect(bindings.logout).not.toHaveBeenCalled();
    expect(bindings.fetch).toHaveBeenCalledTimes(1);
    expect(bindings.setIsDeleting).toHaveBeenLastCalledWith(false);
  });

test.each([[200, { status: 'success' }], [200, scopedReceipt('scoped_deletion_complete')], [409, {}], [503, null]])(
  'legacy or malformed deletion response %s never becomes Account Deleted', async (status, receipt) => {
    const bindings = deletionBindings(status, receipt);
    await handler('src/screens/SettingsScreen.tsx', 'executeAccountDeletion', bindings)();
    expect(bindings.Alert.alert).toHaveBeenCalledWith('Deletion Not Confirmed', expect.stringContaining('not been confirmed deleted'));
    expect(bindings.logout).not.toHaveBeenCalled();
    expect(bindings.fetch).toHaveBeenCalledTimes(1);
  });

test('deletion transport uncertainty is not reported as no deletion and never retries', async () => {
  const bindings = deletionBindings(503, null);
  bindings.fetch.mockRejectedValue(new Error('private-transport-error'));
  await handler('src/screens/SettingsScreen.tsx', 'executeAccountDeletion', bindings)();
  expect(bindings.Alert.alert).toHaveBeenCalledWith('Deletion Not Confirmed', expect.stringContaining('outcome is unknown'));
  expect(JSON.stringify(bindings.Alert.alert.mock.calls)).not.toContain('private-transport-error');
  expect(bindings.logout).not.toHaveBeenCalled();
  expect(bindings.fetch).toHaveBeenCalledTimes(1);
  expect(bindings.setIsDeleting).toHaveBeenLastCalledWith(false);
});

test('deletion confirmation describes limited app-data scope before dispatch', () => {
  const executeAccountDeletion = jest.fn(), alert = jest.fn();
  handler('src/screens/SettingsScreen.tsx', 'handleDeleteAccount', { Alert: { alert }, executeAccountDeletion })();
  expect(alert.mock.calls[0][0]).toBe('Delete App Data');
  expect(alert.mock.calls[0][1]).toContain('does not close your account');
  expect(executeAccountDeletion).not.toHaveBeenCalled();
  alert.mock.calls[0][2].find(action => action.style === 'destructive').onPress();
  expect(executeAccountDeletion).toHaveBeenCalledTimes(1);
});

test('failed profile update keeps the editor open and preserves the displayed profile', async () => {
  const setProfileData = jest.fn(), setEditModalVisible = jest.fn(), alert = jest.fn();
  const run = handler('src/screens/YouScreen.tsx', 'saveProfile', {
    user: { id: 'owner' }, editData: { username: 'fixture', age: '30', profileImage: null }, profileData: { profileImage: null },
    setIsSaving: jest.fn(), setProfileData, setEditModalVisible, Alert: { alert },
    saveProfileUpdate: async () => { throw new Error('permission denied'); },
  });
  await run();
  expect(setProfileData).not.toHaveBeenCalled();
  expect(setEditModalVisible).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('Error', 'Could not save profile. Please try again.');
});

test('native bridge checks prompt completion and never write-sharing permission', () => {
  const swift = fs.readFileSync(path.join(root, 'ios/Delta/HealthKitModule.swift'), 'utf8');
  expect(swift).toContain('getRequestStatusForAuthorization');
  expect(swift).not.toContain('.sharingAuthorized');
  expect(swift).not.toContain('"authorized": success');
});

function historyBindings() {
  const { bindings } = chatBindings();
  return {
    ...bindings,
    AsyncStorage: { ...bindings.AsyncStorage, removeItem: jest.fn(async () => {}) },
    conversationsApi: { getAll: jest.fn(async () => ({ conversations: [{ id: 'server-thread' }] })) },
    restoreConversationIndex: rows => rows,
    readChatTranscriptCache: () => ({ expired: true, conversations: [] }),
    setConversations: jest.fn(), setHistoryLoading: jest.fn(), setHasMoreConversations: jest.fn(),
    conversationOffset: { current: 0 },
  };
}

test('empty device cache still restores the signed-in account history', async () => {
  const bindings = historyBindings();
  await handler(chat, 'loadConversations', bindings)(1);
  expect(bindings.conversationsApi.getAll).toHaveBeenCalledWith('owner');
  expect(bindings.setConversations).toHaveBeenLastCalledWith([{ id: 'server-thread' }]);
  expect(bindings.setHistoryLoading).toHaveBeenLastCalledWith(false);
});

test('expired local transcript cache does not prevent server history restoration', async () => {
  const bindings = historyBindings();
  bindings.AsyncStorage.getItem.mockResolvedValueOnce('expired-fixture');
  await handler(chat, 'loadConversations', bindings)(1);
  expect(bindings.AsyncStorage.removeItem).toHaveBeenCalledTimes(2);
  expect(bindings.conversationsApi.getAll).toHaveBeenCalledWith('owner');
  expect(bindings.setConversations).toHaveBeenLastCalledWith([{ id: 'server-thread' }]);
});

test('late account-history response cannot populate a different account', async () => {
  const bindings = historyBindings();
  bindings.conversationsApi.getAll.mockImplementation(async () => {
    bindings.accountRef.current = 'other';
    bindings.operationRevision.current++;
    return { conversations: [{ id: 'server-thread' }] };
  });
  await handler(chat, 'loadConversations', bindings)(1);
  expect(bindings.setConversations).not.toHaveBeenCalled();
  expect(bindings.setHistoryLoading).not.toHaveBeenCalledWith(false);
});
