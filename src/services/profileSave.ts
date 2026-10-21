import { supabase } from './supabase';

export interface ProfileUpdate {
  name: string;
  username: string | null;
  age: number | null;
  gender: string | null;
  avatar_url: string | null;
  bio: string;
}

export async function saveProfileUpdate(userId: string, fields: ProfileUpdate): Promise<void> {
  const { data, error } = await supabase.from('profiles').update(fields).eq('id', userId).select('id').single();
  if (error?.code === '23505') throw new Error('This username is already taken');
  if (error || data?.id !== userId) throw new Error('Could not save profile. Please try again.');
}
