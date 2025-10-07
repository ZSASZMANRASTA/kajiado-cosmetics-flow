-- Add explicit policy to deny anonymous access to profiles
-- This makes it crystal clear that unauthenticated users cannot access profile data
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Ensure the UPDATE policy is also restricted to authenticated users
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Authenticated users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());