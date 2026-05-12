-- Prevent duplicate pending cook applications at the database level.
-- A user can only have ONE application with status = 'pending' at a time.
-- They can still reapply after a rejection (status = 'rejected').

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_application
  ON public.cook_applications (user_id)
  WHERE (status = 'pending');
