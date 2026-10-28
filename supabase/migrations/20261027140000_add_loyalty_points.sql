alter table public.profiles add column loyalty_points int default 0 not null;

-- Award 1 point per ₵1 spent, the moment an order is marked Completed.
-- Points go to the eater (orders.user_id), not the cook — this is a
-- spend-based reward for ordering, shown on the eater's profile card.
create or replace function public.award_loyalty_points()
returns trigger as $$
begin
  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    update public.profiles
    set loyalty_points = loyalty_points + floor(new.total)::int
    where id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger tr_award_loyalty_points
  after update on public.orders
  for each row execute function public.award_loyalty_points();
