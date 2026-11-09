import { differenceInCalendarDays, differenceInHours, differenceInMinutes, format, isSameDay } from 'date-fns';

// A booking in YenDidii is a seat at a gathering on a day and time (the listing's order_deadline), not a take-away order.
// So "Ready" can't always mean "come now": the host may mark things ready days before the gathering. These helpers decide what
// the guest should be told, the way a reservation page does: confirmed until the day, "head over" only when it's time.

// Within this long of the start (or after it), a ready table means come now.
export const COME_NOW_WITHIN_HOURS = 3;

export function parseEventAt(raw?: string | null): Date | null {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
}

// The earliest gathering time among an order's items (most orders have one).
export function earliestEventAt(items: { listings?: { order_deadline?: string | null } | null }[] | null | undefined): Date | null {
    const times = (items || [])
        .map((i) => parseEventAt(i.listings?.order_deadline))
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime());
    return times[0] ?? null;
}

export function bookingTiming(eventAt: Date | null, now: Date = new Date()) {
    if (!eventAt) return { scheduled: false, isFuture: false, comeNow: true };
    const msUntil = eventAt.getTime() - now.getTime();
    return { scheduled: true, isFuture: msUntil > 0, comeNow: msUntil <= COME_NOW_WITHIN_HOURS * 60 * 60 * 1000 };
}

// For a gathering that is still some way off, "Cooking" and "Ready" are just the host preparing: to the guest the booking is
// simply confirmed until the day comes.
export function displayStatusFor(status: string, eventAt: Date | null, now: Date = new Date()): string {
    const t = bookingTiming(eventAt, now);
    if (t.scheduled && !t.comeNow && (status === 'Cooking' || status === 'Ready')) return 'Accepted';
    return status;
}

export const tableReadyNow = (status: string, eventAt: Date | null, now: Date = new Date()) =>
    status === 'Ready' && bookingTiming(eventAt, now).comeNow;

export const formatEventDate = (d: Date) => format(d, 'EEEE, d MMM');      // Saturday, 15 Nov
export const formatEventTime = (d: Date) => format(d, 'h:mm a');          // 7:00 PM
export const formatEventShort = (d: Date) => format(d, 'EEE, MMM d • h:mm a'); // Sat, Nov 15 • 7:00 PM (same as the host's list)
export const formatEventSentence = (d: Date) => `${format(d, 'EEE d MMM')} at ${format(d, 'h:mm a')}`; // Sat 15 Nov at 7:00 PM

// "In 4 days", "Tomorrow", "In 3 hours", "Happening now".
export function countdownLabel(eventAt: Date, now: Date = new Date()): string {
    if (eventAt.getTime() <= now.getTime()) return 'Happening now';
    if (isSameDay(eventAt, now)) {
        const hours = differenceInHours(eventAt, now);
        if (hours >= 1) return `In ${hours} hour${hours === 1 ? '' : 's'}`;
        const minutes = Math.max(1, differenceInMinutes(eventAt, now));
        return `In ${minutes} minute${minutes === 1 ? '' : 's'}`;
    }
    const days = differenceInCalendarDays(eventAt, now);
    return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

export const formatEventHero = (d: Date) => `${format(d, 'EEE d MMM')} · ${format(d, 'h:mm a')}`; // Fri 6 Nov · 8:00 PM
