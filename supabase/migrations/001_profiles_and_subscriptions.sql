-- Profiles table with avatar_url for cloud sync
-- Run this in your Supabase SQL editor if not already applied

-- Add avatar_url column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Create avatars storage bucket (run in Supabase dashboard > Storage)
-- 1. Create bucket named "avatars"
-- 2. Make it public (or use signed URLs)
-- 3. Add policy to allow authenticated users to upload to their own folder

-- Storage policies for avatars bucket:
-- INSERT policy: Allow users to upload to their own folder
-- CREATE POLICY "Users can upload their own avatar"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- SELECT policy: Allow public access to avatars
-- CREATE POLICY "Public avatar access"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'avatars');

-- UPDATE policy: Allow users to update their own avatar
-- CREATE POLICY "Users can update their own avatar"
-- ON storage.objects FOR UPDATE
-- USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- DELETE policy: Allow users to delete their own avatar
-- CREATE POLICY "Users can delete their own avatar"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
