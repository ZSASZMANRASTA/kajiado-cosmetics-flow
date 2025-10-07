-- Drop the combined policy
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.profiles;

-- Create separate policies: one for users to view their own, one for admins to view all
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));