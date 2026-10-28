# Mockup → Real Data Audit

Everything found across three sweeps of the app: fake/hardcoded data still in the UI, real data with no UI, and dead-end interactions. Ordered easy → hard so we can knock them out in sequence.

---

## 🟢 Easy (delete or one-line swap, no new backend) — ✅ DONE

- [x] **Delete `MOCK_MAIN_DISHES`** — `app/(tabs)/index.tsx:79-115`. Exported but never imported anywhere. Dead code.
- [x] **Delete `PAST_ORDERS`** — `app/(tabs)/cook.tsx:26-29`. Same, unused fake array.
- [x] **Remove debug `console.log` payload dumps** — `app/onboarding/apply-to-cook.tsx:228,234,259` (`INSERT PAYLOAD`, `PROFILE UPDATE RESULT`).
- [x] **Swap hardcoded `"4.8"` for the real rating** — `app/meal/[id].tsx:172,203`. Also caught and fixed a third hardcoded `"5"` per-cook rating in the same screen (line ~357) found while implementing.
- [x] **Swap hardcoded `"120 orders today"` for something real** — `app/meal/[id].tsx:212`. Now shows a real `{totalServed}+ served` computed from `profiles.served_count` across listings (hidden when 0).
- [x] **Fix silent error-swallowing** — `console.log` → `console.error` in `profile.tsx:264`, `map.tsx:128`, `listing/[id].tsx:259`, `apply-to-cook.tsx:153`.

---

## 🟡 Medium (real query/wiring needed, no new tables) — ✅ DONE

- [x] **Wire up dead-tap header icons** — Share buttons on `meal/[id].tsx` and `session/[id].tsx` now use real `Share.share()`. Heart/favorite buttons on both screens now wired to the **existing local favorites store** (`AsyncStorage` key `yendidii_favorites`, already used by `index.tsx`/`listing/[id].tsx`) — turned out a real mechanism already existed, just unwired here. Also wired the session screen's "Host" card to navigate to the cook's profile.
- [x] **Fix `stats.reviews` / `stats.saved` stuck at 0** — `reviews` now a real count query against the `reviews` table; `saved` now reads the same `yendidii_favorites` AsyncStorage store instead of never updating.
- [x] **Surface `meal_sessions.min_requests_required`** — session screen now shows real progress toward the confirmation minimum instead of a slots-based approximation.
- [x] **Surface `meal_sessions.max_per_user`** — quantity stepper now caps at the real per-user max (was previously only capped by remaining slots, so users could hit a server-side trigger error).
- [x] **Surface `meal_sessions.session_note`** — now rendered in its own callout, separate from `description`.
- [x] **Decide fate of the "Fastest Delivery" section** — removed. Its two categories don't map cleanly onto the map screen's existing single-category filter without extending that screen's filter logic, so it was fake decoration, not a quick wire-up.
- [x] **Decide fate of the fake `4.8` rating fallback** — `listing/[id].tsx` now shows "New" for cooks with no rating instead of fabricating 4.8.

---

## 🏗️ Architecture change — Join the Pot merged into Orders

The old `meal_sessions`/`meal_reservations` system was a separate, disconnected flow — reserving a "pot" spot never created an `orders` row, so it had no payment, tracking, or review linkage, and its `handleReserve` screen didn't even write a reservation to the DB. Rather than fix that dead-end screen, we retired it and moved the two features that actually mattered (a minimum-orders threshold and an optional deadline) directly onto `listings`, reusing the existing, working order pipeline:

- [x] Migration `20260831202406_add_pot_fields_to_listings.sql` — added `listings.min_orders_required` (default 1, no behavior change for existing listings) and `listings.order_deadline` (nullable). Applied to the live DB.
- [x] `cook.tsx` — replaced the "Join the Pot" toggle + separate session-creation form (in both the edit and new-dish flows) with two always-visible fields: minimum orders to confirm, and an optional "closes in N hours" deadline. Also capped portions to 5 per listing (`MAX_PORTIONS`) in the form, not a DB constraint.
- [x] `listing/[id].tsx`, `meal/[id].tsx`, `order/[id].tsx` — all now show live pot progress ("X/Y joined, Z more needed, closes in...") computed from real `order_items` counts, not the old `meal_sessions.filled_slots`. `listing/[id].tsx` also blocks checkout once the deadline passes.
- [x] Removed `app/session/[id].tsx` entirely (nothing links to it anymore) and the dead `meal_sessions` queries in `index.tsx`.
- [x] The cook still manually moves an order through New→Accepted→Cooking→Ready like today — no new order status, no cron, no auto-refund. The minimum/deadline are informational for now; the cook decides what to do if a pot doesn't fill.
- `meal_sessions`/`meal_reservations` tables were left in the live DB, unused — not dropped, since that's a one-way action on production data. Ask separately if/when you want them cleaned up.

---

## ✅ Profile settings screens — built out

`profile.tsx`'s Personal Info, Payment Methods, and Privacy & Security rows were all `Alert.alert("coming soon")`; `address/index.tsx` saved a fake `Lat: X, Lng: Y` string instead of a real address. Also fixed `profile.tsx`'s slow load (5 sequential Supabase round-trips → one `Promise.all` batch).

- [x] `app/personal-information.tsx` — edits `profiles.full_name`; phone shown read-only (changing it needs re-verification, out of scope here) with member-since date.
- [x] `app/payment-methods.tsx` — accepted-methods reference card (Card/MTN MoMo/Vodafone Cash/AirtelTigo, matching the existing `getPaymentLabel` taxonomy and Paystack `defaultChannels` config) + real payment history from `orders` (`total`, `payment_method`, `payment_status`, `payment_reference`), tappable through to `order/[id]`. No saved-card table exists, so this is history + accepted methods, not stored cards. Notes that Cook Mode earnings/payouts aren't tracked yet rather than faking a payout number.
- [x] `app/privacy-security.tsx` — real account summary (`profiles.verified`, `phone`, `created_at`), **Sign out of all devices** (`supabase.auth.signOut({ scope: 'global' })`), and **Delete Account** (new `delete_user_account()` SECURITY DEFINER RPC, migration `20260925120000_add_delete_account_function.sql`, applied to the live DB — every `profiles`/`user_id` FK in the schema is already `on delete cascade` so this cleans up orders/listings/reviews/etc. in one shot).
- [x] `app/address/index.tsx` — now reverse-geocodes the picked map point via `Location.reverseGeocodeAsync` (same pattern as `profile.tsx`'s `useCurrentLocation`) instead of saving coordinates as a text string, and loads/displays the existing saved address on mount.
- [x] All three wired into `SETTINGS_ITEMS` in `profile.tsx`, replacing the `Alert.alert` stubs.

---

## 🔴 Hard (new backend work, new screens, or a genuinely broken flow) — DEFERRED

None of these block the app from running — they're missing/fake features, not crashes. Picking them off later as backlog, in no fixed order yet.

- [ ] **Reviews: wire the read side** — `reviews` table already exists and drives a `refresh_cook_stats` trigger on write, but nothing ever queries it for display. `app/cook/[id].tsx:258-262`'s Reviews tab is a static placeholder. Needs: a real `.select()` joined to reviewer name, rendered as a list. **Highest-value fix — the backend already does the hard part.**
- [ ] **Cook Photos/gallery tab** — `app/cook/[id].tsx:265-268`, static "coming soon." Needs real photo storage + gallery UI (`cook_applications.food_photos` already exists in schema and is unused — may be reusable).
- [ ] **Order notes + delivery method/address** — `orders.notes`, `orders.delivery_address`, `delivery_method` are real columns, fully selected in `order/[id].tsx`, never rendered — and never collected either, since `cart.tsx:121` hardcodes `delivery_method: 'Dine-in'`. Needs a checkout-side "note to the cook" input before the display side matters.
- [ ] **Cook trust/verification badges** — `cook_applications.hygiene_certified`, `id_document_url`, `food_photos`, `reviewed_at` exist for moderation but have zero references in `app/`. No admin review screen, no public badge beyond the generic `profiles.verified` checkmark. Needs both an admin surface and a public trust-badge treatment.
- [ ] **Pickup/delivery flags — unwired end-to-end** — `listings.pickup_available`/`delivery_available` aren't set in the cook's listing form and aren't read by eaters either. Needs a form control + eater-facing display/filter, essentially a small feature build, not a fix.
- [ ] **Rewards / "Sankofa Tier" loyalty card** — `profile.tsx:780-903` is fully static (`1,240 pts`, fixed 75% bar, hardcoded tier states) — same numbers shown to every user. No points/loyalty table exists at all. Either build the real system or hide the card until there is one.
- [ ] **Promo codes** — two separate hardcoded instances (`profile.tsx:138,142,887` and `notifications.tsx` `STATIC_PROMOS`) presented as real per-user rewards with no coupon/redemption table behind them.
- [ ] **Generic dine-in photos on every listing** — `app/listing/[id].tsx` `DINE_IN_PHOTOS` shows the same 3 stock images on every single listing instead of the actual cook's kitchen. Depends on the photo-gallery work above.
- [ ] **Push notifications** — `expo-notifications` isn't even installed. `notifications.tsx` is a client-derived feed with no read-state persistence (resets every app load). Full feature build: permissions, token registration, and a way for the backend to actually send one.

---

## Notes
- Backend for most "Hard" items already has some scaffolding (reviews table + trigger, food_photos column, hygiene_certified column) — several of these are UI/wiring gaps on top of a partially-built backend, not blank-slate features.
