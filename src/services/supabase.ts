/**
 * Supabase Client Configuration
 *
 * Uses the anon (public) key for client-side authentication.
 * The secret key should NEVER be used in mobile apps.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://fhbfaoowwnzzynhbgcms.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYmZhb293d256enluaGJnY21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NTQxOTcsImV4cCI6MjA4NDUzMDE5N30.tLvdwDBL9ftVq-xb2C9UCm4MXb8r2owNMlSL_G_iM8k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
