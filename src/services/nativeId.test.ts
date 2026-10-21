import { newClientId } from './nativeId';
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
const native = globalThis as unknown as { expo?: { uuidv4?: () => string } };
const original = native.expo;
afterEach(() => { native.expo = original; });
test('native chat IDs work without a browser crypto global', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  native.expo = { uuidv4: jest.fn(() => id) };
  expect(newClientId()).toBe(id);
});
test('missing native generator fails explicitly, without weak IDs', () => {
  native.expo = {};
  expect(newClientId).toThrow('Secure ID generation is unavailable');
});
test('malformed native result is rejected', () => {
  native.expo = { uuidv4: () => 'conv_timestamp' };
  expect(newClientId).toThrow();
});
