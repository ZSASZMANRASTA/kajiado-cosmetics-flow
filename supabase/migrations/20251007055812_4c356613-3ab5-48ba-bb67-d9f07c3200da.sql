-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create restrictive policy: users can only view their own profile OR admins can view all
CREATE POLICY "Users can view own profile or admins can view all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);

-- Keep the update policy as is (users can update their own profile)
-- The existing policy "Users can update their own profile" is already secure