import { accountIsApproved } from './accountAdmission';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
test.each([
  [{ status: 'valid', user: { user_id: 'a' } }, true],
  [{ status: 'valid', user: { user_id: 'b' } }, false],
  [{ status: 'valid', user: { user_id: 'a', is_guest: true } }, false],
  [{ status: 'invalid' }, false],
])('only accepts the approved matching account', async (body, expected) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body });
  expect(await accountIsApproved('fixture', 'a')).toBe(expected);
});
test('network failure cannot grant access or expose errors', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('private credential detail'));
  expect(await accountIsApproved('fixture', 'a')).toBe(false);
});
