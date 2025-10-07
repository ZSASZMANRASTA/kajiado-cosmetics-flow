-- Drop the overly permissive SELECT policy on sales table
DROP POLICY IF EXISTS "Authenticated users can view sales" ON public.sales;

-- Create restrictive policy: admins see all, cashiers see only their own
CREATE POLICY "Users can view their own sales or admins can view all"
ON public.sales
FOR SELECT
TO authenticated
USING (
  cashier_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);

-- Drop the overly permissive SELECT policy on sale_items table
DROP POLICY IF EXISTS "Authenticated users can view sale items" ON public.sale_items;

-- Create restrictive policy: users can only see sale items for sales they have access to
CREATE POLICY "Users can view sale items for their own sales"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
    AND (sales.cashier_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
);