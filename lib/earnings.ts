// What the platform keeps from each completed order, and the smallest payout a host can request.
// Used by the payout screen and the dashboard's Business Overview so both always agree.
export const PLATFORM_FEE_PERCENT = 10;
export const MIN_PAYOUT = 30;

// The host's share of an order total, after the platform fee.
export const netOf = (total: number) => total * (1 - PLATFORM_FEE_PERCENT / 100);

// Promo discounts are platform-funded: the guest pays `total`, but the host is paid on the full price (total + the discount),
// so a promo never reduces what the host earns. `discount` is orders.discount_amount.
export const hostNetOf = (total: number, discount = 0) => netOf(total + (discount || 0));
