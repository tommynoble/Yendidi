-- ID VERIFICATION
-- Records who has passed an ID check. Only the server (service role) or the database owner (SQL editor) can change these
-- fields. People can't mark themselves verified from the app.

alter table public.profiles
  add column if not exists id_verified boolean not null default false,
  add column if not exists id_verified_at timestamp with time zone,
  add column if not exists id_verification_provider text,   -- e.g. 'smileid'
  add column if not exists id_verification_ref text,        -- the provider's reference for this check
  add column if not exists address_confirmed boolean not null default false,  -- hosts: address confirmed
  add column if not exists address_confirmed_at timestamp with time zone;

-- Lock those columns: app users (anon/authenticated) can't set or change them, on insert or update.
create or replace function public.protect_verification_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.id_verified := false;
      new.id_verified_at := null;
      new.id_verification_provider := null;
      new.id_verification_ref := null;
      new.address_confirmed := false;
      new.address_confirmed_at := null;
    elsif (
      new.id_verified is distinct from old.id_verified
      or new.id_verified_at is distinct from old.id_verified_at
      or new.id_verification_provider is distinct from old.id_verification_provider
      or new.id_verification_ref is distinct from old.id_verification_ref
      or new.address_confirmed is distinct from old.address_confirmed
      or new.address_confirmed_at is distinct from old.address_confirmed_at
    ) then
      raise exception 'Verification fields can only be changed by the server';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_verification_columns
  before insert or update on public.profiles
  for each row execute function public.protect_verification_columns();
