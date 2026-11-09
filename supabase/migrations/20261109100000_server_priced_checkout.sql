-- SERVER-PRICED CHECKOUT
-- Until now the phone worked out the price, charged Paystack that amount, then created the orders itself, so nothing on the
-- server checked what was paid. Now:
--   1. quote_cart()        prices a cart on the server (listing prices from the database, promo code checked here).
--   2. place_paid_orders() runs only from the place-order edge function, after Paystack has confirmed the payment, and only
--                          creates the orders if the amount paid matches the server's price.
-- Promo discounts are platform-funded: the order keeps what the guest paid in `total` and the discount in `discount_amount`,
-- and the host's payout is worked out on total + discount_amount.

alter table public.orders
  add column if not exists discount_amount numeric not null default 0 check (discount_amount >= 0),
  add column if not exists promo_code text;

-- One line per listing in a cart, with quantities added up.
create or replace function public._cart_lines(p_items jsonb)
returns table (listing_id uuid, qty int)
language sql
stable
as $$
  select (e->>'listing_id')::uuid, sum((e->>'quantity')::int)::int
  from jsonb_array_elements(p_items) e
  group by 1
$$;

revoke all on function public._cart_lines(jsonb) from public, anon, authenticated;
grant execute on function public._cart_lines(jsonb) to service_role;

-- Prices a cart for a given user. Internal: the app calls quote_cart() below instead.
create or replace function public._price_cart(p_user uuid, p_items jsonb, p_promo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(upper(trim(coalesce(p_promo, ''))), '');
  v_promo public.promo_codes%rowtype;
  v_percent int := 0;
  v_bad int;
  r record;
  v_gross numeric;
  v_disc numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_per_cook jsonb := '[]'::jsonb;
  v_items jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_cart');
  end if;

  if exists (select 1 from public._cart_lines(p_items) where qty is null or qty < 1 or qty > 50) then
    return jsonb_build_object('ok', false, 'error', 'bad_quantity');
  end if;

  select count(*) into v_bad
  from public._cart_lines(p_items) q left join public.listings l on l.id = q.listing_id
  where l.id is null;
  if v_bad > 0 then
    return jsonb_build_object('ok', false, 'error', 'item_not_found');
  end if;

  select count(*) into v_bad
  from public._cart_lines(p_items) q join public.listings l on l.id = q.listing_id
  where coalesce(l.available, true) = false
     or (l.portions_available is not null and l.portions_available < q.qty);
  if v_bad > 0 then
    return jsonb_build_object('ok', false, 'error', 'sold_out');
  end if;

  if v_code is not null then
    select * into v_promo from public.promo_codes where code = v_code and active = true;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'promo_not_found');
    end if;
    if v_promo.expires_at is not null and v_promo.expires_at < now() then
      return jsonb_build_object('ok', false, 'error', 'promo_expired');
    end if;
    if v_promo.max_redemptions is not null and v_promo.redemption_count >= v_promo.max_redemptions then
      return jsonb_build_object('ok', false, 'error', 'promo_exhausted');
    end if;
    if exists (select 1 from public.promo_redemptions where code = v_code and user_id = p_user) then
      return jsonb_build_object('ok', false, 'error', 'promo_already_used');
    end if;
    v_percent := v_promo.discount_percent;
  end if;

  -- One order per host, so the discount is rounded per host.
  for r in
    select l.cook_id, sum(l.price * q.qty) as gross
    from public._cart_lines(p_items) q join public.listings l on l.id = q.listing_id
    group by l.cook_id
    order by l.cook_id
  loop
    v_gross := r.gross;
    v_disc := round(v_gross * v_percent / 100.0, 2);
    v_subtotal := v_subtotal + v_gross;
    v_discount := v_discount + v_disc;
    v_total := v_total + (v_gross - v_disc);
    v_per_cook := v_per_cook || jsonb_build_object('cook_id', r.cook_id, 'gross', v_gross, 'discount', v_disc, 'total', v_gross - v_disc);
  end loop;

  select jsonb_agg(jsonb_build_object('listing_id', l.id, 'quantity', q.qty, 'price', l.price, 'cook_id', l.cook_id))
  into v_items
  from public._cart_lines(p_items) q join public.listings l on l.id = q.listing_id;

  return jsonb_build_object(
    'ok', true,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total', v_total,
    'percent', v_percent,
    'promo_code', v_code,
    'per_cook', v_per_cook,
    'items', v_items
  );
end;
$$;

revoke all on function public._price_cart(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public._price_cart(uuid, jsonb, text) to service_role;

-- What the app calls to show a price and decide how much to charge.
create or replace function public.quote_cart(p_items jsonb, p_promo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  return public._price_cart(auth.uid(), p_items, p_promo);
end;
$$;

grant execute on function public.quote_cart(jsonb, text) to authenticated;

-- Creates the orders for a payment Paystack has already confirmed. Only the place-order edge function (service role) can call it.
create or replace function public.place_paid_orders(
  p_user uuid,
  p_reference text,
  p_paid_pesewas bigint,
  p_items jsonb,
  p_promo text,
  p_method text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid[];
  q jsonb;
  c jsonb;
  it jsonb;
  v_order_id uuid;
  v_ids uuid[] := '{}';
  v_notes text;
  v_code text;
  v_percent int;
begin
  -- The same payment reference only ever creates orders once (a retry just returns them).
  perform pg_advisory_xact_lock(hashtext(p_reference));
  select array_agg(id) into v_existing from public.orders where payment_reference = p_reference and user_id = p_user;
  if v_existing is not null then
    return jsonb_build_object('ok', true, 'order_ids', to_jsonb(v_existing), 'already', true);
  end if;

  -- Lock the listings being bought so two checkouts can't both take the last portions.
  perform 1 from public.listings
   where id in (select (e->>'listing_id')::uuid from jsonb_array_elements(p_items) e)
   for update;

  q := public._price_cart(p_user, p_items, p_promo);
  if not coalesce((q->>'ok')::boolean, false) then
    raise exception 'cart_invalid: %', q->>'error';
  end if;
  if round((q->>'total')::numeric * 100) <> p_paid_pesewas then
    raise exception 'amount_mismatch: paid % but the cart costs %', p_paid_pesewas, round((q->>'total')::numeric * 100);
  end if;

  v_code := q->>'promo_code';
  v_percent := (q->>'percent')::int;
  v_notes := nullif(concat_ws(' · ',
    nullif(trim(coalesce(p_notes, '')), ''),
    case when v_code is not null then format('Promo applied: %s (-%s%%)', v_code, v_percent) end
  ), '');

  for c in select * from jsonb_array_elements(q->'per_cook') loop
    insert into public.orders (user_id, cook_id, status, total, delivery_method, delivery_address, payment_reference, payment_method, payment_status, notes, discount_amount, promo_code)
    values (p_user, (c->>'cook_id')::uuid, 'New', (c->>'total')::numeric, 'Dine-in', null, p_reference, p_method, 'success', v_notes, (c->>'discount')::numeric, v_code)
    returning id into v_order_id;
    v_ids := v_ids || v_order_id;

    for it in select * from jsonb_array_elements(q->'items') loop
      if (it->>'cook_id')::uuid = (c->>'cook_id')::uuid then
        insert into public.order_items (order_id, listing_id, quantity, price_at_purchase)
        values (v_order_id, (it->>'listing_id')::uuid, (it->>'quantity')::int, (it->>'price')::numeric);

        update public.listings
           set portions_available = greatest(0, portions_available - (it->>'quantity')::int),
               available = (portions_available - (it->>'quantity')::int) > 0
         where id = (it->>'listing_id')::uuid
           and portions_available is not null;
      end if;
    end loop;
  end loop;

  if v_code is not null then
    insert into public.promo_redemptions (code, user_id, order_id) values (v_code, p_user, v_ids[1]);
  end if;

  return jsonb_build_object('ok', true, 'order_ids', to_jsonb(v_ids), 'total', (q->>'total')::numeric);
end;
$$;

revoke all on function public.place_paid_orders(uuid, text, bigint, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.place_paid_orders(uuid, text, bigint, jsonb, text, text, text) to service_role;

notify pgrst, 'reload schema';
