-- Supabase Realtime RLS Policy for Report Table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/oeogixklftlxewgrmvnm/sql

-- Option 1: Allow ALL authenticated users to read reports (simplest for testing)
CREATE POLICY "Allow all to read reports for realtime"
ON "Report"
FOR SELECT
TO anon, authenticated
USING (true);

-- OR Option 2: Only allow admins to read reports (more secure)
-- Uncomment this and comment out Option 1 if you want admin-only access
/*
CREATE POLICY "Allow admins to read reports"
ON "Report"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "User"
    WHERE "User".id = auth.uid()::uuid
    AND "User".role = 'ADMIN'
  )
);
*/

-- Check existing policies
-- SELECT * FROM pg_policies WHERE tablename = 'Report';
