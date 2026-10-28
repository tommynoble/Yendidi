import { differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';

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
