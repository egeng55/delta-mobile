import { saveProfileUpdate } from './profileSave';
import { supabase } from './supabase';
jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }));
const fields = { name: 'Fixture', username: null, age: 30, gender: null, avatar_url: null, bio: '' };
const single = jest.fn();
const eq = jest.fn(() => ({ select: () => ({ single }) }));
beforeEach(() => {
  (supabase.from as jest.Mock).mockReturnValue({ update: () => ({ eq }) });
});
test.each([
  [{ error: { code: '42501' }, data: null }, 'Could not save'],
  [{ error: { code: '23505' }, data: null }, 'already taken'],
  [{ error: null, data: null }, 'Could not save'],
  [{ error: null, data: { id: 'other' } }, 'Could not save'],
])('fails for rejected or zero-row updates: %j', async (result, message) => {
  single.mockResolvedValue(result);
  await expect(saveProfileUpdate('owner', fields)).rejects.toThrow(message);
});
test('accepts only the updated owner row', async () => {
  single.mockResolvedValue({ error: null, data: { id: 'owner' } });
  await expect(saveProfileUpdate('owner', fields)).resolves.toBeUndefined();
  expect(eq).toHaveBeenCalledWith('id', 'owner');
});
