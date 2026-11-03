// What the platform keeps from each completed order, and the smallest payout a host can request.
// Used by the payout screen and the dashboard's Business Overview so both always agree.
export const PLATFORM_FEE_PERCENT = 10;
export const MIN_PAYOUT = 30;

// The host's share of an order total, after the platform fee.
export const netOf = (total: number) => total * (1 - PLATFORM_FEE_PERCENT / 100);
