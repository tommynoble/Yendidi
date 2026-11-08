import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';

// Once the deadline has passed there's nothing left to count down, so cards
// should just stop showing the badge rather than display "Starting now".
export function isPotCountdownActive(deadline: string | Date): boolean {
    const target = typeof deadline === 'string' ? new Date(deadline) : deadline;
    return target.getTime() > new Date().getTime();
}

// Dynamic urgency label for a scheduled "Join the Pot" listing — shifts from
// days to hours to minutes as the cook's session start time approaches.
export function formatPotCountdown(deadline: string | Date): string {
    const target = typeof deadline === 'string' ? new Date(deadline) : deadline;
    const now = new Date();

    if (target.getTime() <= now.getTime()) return 'Starting now';

    const days = differenceInDays(target, now);
    if (days >= 1) return `${days} Day${days === 1 ? '' : 's'} Remaining`;

    const hours = differenceInHours(target, now);
    if (hours >= 1) return `Starts in ${hours} Hour${hours === 1 ? '' : 's'}`;

    const minutes = Math.max(1, differenceInMinutes(target, now));
    return `Starts in ${minutes} Minute${minutes === 1 ? '' : 's'}`;
}

// Label for the badges on event cards: anything a week or more away reads "More than 7 days out",
// then it switches to the exact countdown ("6 Days Remaining", "Starts in 5 Hours"...) inside the last week.
export function formatPotCountdownBadge(deadline: string | Date): string {
    const target = typeof deadline === 'string' ? new Date(deadline) : deadline;
    if (differenceInDays(target, new Date()) >= 7) return 'More than 7 days out';
    return formatPotCountdown(deadline);
}

// Compact version for small badges on cards: "8d left", "5h left", "40m left".
export function formatPotCountdownShort(deadline: string | Date): string {
    const target = typeof deadline === 'string' ? new Date(deadline) : deadline;
    const now = new Date();

    if (target.getTime() <= now.getTime()) return 'Starting now';

    const days = differenceInDays(target, now);
    if (days >= 1) return `${days}d left`;

    const hours = differenceInHours(target, now);
    if (hours >= 1) return `${hours}h left`;

    return `${Math.max(1, differenceInMinutes(target, now))}m left`;
}

// Badge for compact cards: a short cue ("7d left", "3d left", "21h left") up to a week out, nothing when the event
// is more than a week away (the date is already on the card), so far-off events don't carry a sentence-long badge.
export function formatPotCountdownCompactBadge(deadline: string | Date): string | null {
    const target = typeof deadline === 'string' ? new Date(deadline) : deadline;
    if (differenceInDays(target, new Date()) > 7) return null;
    return formatPotCountdownShort(deadline);
}
