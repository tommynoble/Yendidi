import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';

export const DAYS = [
    { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
];

export const TIME_PRESETS = [
    { label: '12:00 PM', value: '12:00' },
    { label: '1:00 PM', value: '13:00' },
    { label: '6:00 PM', value: '18:00' },
    { label: '7:00 PM', value: '19:00' },
    { label: '8:00 PM', value: '20:00' },
];

export const MIN_GAP_DAYS = 2;
export const MAX_SESSIONS = 2;
// Each cook day has a pool of this many total servings to split across
// however many dishes the cook attaches to it — not 6 servings per dish.
export const SESSION_SERVING_CAP = 6;

export function nextDateForWeekday(weekday: number): Date {
    const today = new Date();
    const diff = (weekday - today.getDay() + 7) % 7;
    return addDays(today, diff);
}

// Cooking sessions need at least MIN_GAP_DAYS full days between them.
export function isTooCloseToExistingSessions(candidateDate: Date, existingSessions: { session_date: string }[]): boolean {
    return existingSessions.some((s) =>
        Math.abs(differenceInCalendarDays(candidateDate, parseISO(s.session_date))) < MIN_GAP_DAYS
    );
}
