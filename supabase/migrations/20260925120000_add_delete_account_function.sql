-- Lets a signed-in user permanently delete their own account from the app
-- (Privacy & Security screen). Deleting straight from auth.users requires
-- elevated privileges the client doesn't have, so this runs as
-- SECURITY DEFINER; every table with a profiles/user FK is already
-- `on delete cascade`, so removing the auth.users row cleans up profiles,
-- orders, listings, reviews, cook_applications, etc. in one shot.
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_user_account() to authenticated;
