import { LucideIcon, BadgeCheck, Beef, Briefcase, CakeSlice, Carrot, CheckCircle2, Egg, Fish, Heart, House, Luggage, Milk, Music, Nut, Plane, Salad, Sandwich, Shrimp, Soup, Sprout, Trees, User, UserPlus, Users, UsersRound, Wheat, WheatOff, Wine } from 'lucide-react-native';

// The sign-up questions, shared by the onboarding screen and the profile views. Reword a step here and every screen follows.
// Public answers (everything except `dietary`) can be shown on a guest's profile; `dietary` is private to the guest and their hosts.
export type Option = { id: string; icon: LucideIcon; label: string; /** picking this clears the other answers, e.g. "None" */ exclusive?: boolean };
export type Step = { id: string; title: string; subtitle: string; single?: boolean; options: Option[] };

// The sign-up questions. Add, remove or reword a step here and the screen, progress bar and saved answers follow.
export const GUEST_QUESTIONS: Step[] = [
    {
        id: 'foods',
        title: 'What are you craving?',
        subtitle: 'Pick the dishes that make your mouth water.',
        options: [
            { id: 'swallows', icon: Soup, label: 'Swallows & light soup' },
            { id: 'rice', icon: Wheat, label: 'Waakye & jollof' },
            { id: 'grills', icon: Beef, label: 'Grills & kebabs' },
            { id: 'seafood', icon: Fish, label: 'Seafood' },
            { id: 'veg', icon: Salad, label: 'Vegetarian & vegan' },
            { id: 'street', icon: Sandwich, label: 'Street snacks' },
            { id: 'sweet', icon: CakeSlice, label: 'Pastries & sweets' },
        ],
    },
    {
        id: 'vibe',
        title: "What's your table vibe?",
        subtitle: "We'll point you to gatherings that feel like you.",
        options: [
            { id: 'rooftop', icon: Wine, label: 'Rooftop & drinks' },
            { id: 'garden', icon: Trees, label: 'Garden & intimate' },
            { id: 'communal', icon: Users, label: 'Communal & social' },
            { id: 'cozy', icon: House, label: 'Cozy home dinner' },
            { id: 'lively', icon: Music, label: 'Lively & loud' },
        ],
    },
    {
        id: 'company',
        title: 'Who do you like to eat with?',
        subtitle: 'Every table is better with the right company.',
        options: [
            { id: 'friends', icon: Users, label: 'Friends' },
            { id: 'family', icon: UsersRound, label: 'Family' },
            { id: 'date', icon: Heart, label: 'Date night' },
            { id: 'colleagues', icon: Briefcase, label: 'Colleagues' },
            { id: 'new', icon: UserPlus, label: 'Meeting new people' },
            { id: 'solo', icon: User, label: 'Just me for now' },
        ],
    },
    {
        id: 'travel',
        title: 'Do you love to travel?',
        subtitle: 'Great food is often a passport.',
        single: true,
        options: [
            { id: 'always', icon: Plane, label: 'Always exploring' },
            { id: 'sometimes', icon: Luggage, label: 'Now and then' },
            { id: 'close', icon: House, label: 'I like staying close to home' },
        ],
    },
    {
        id: 'dietary',
        title: 'Any allergies or dietary needs?',
        subtitle: "We'll let hosts know, so every plate is safe for you.",
        options: [
            { id: 'nuts', icon: Nut, label: 'Nuts' },
            { id: 'shellfish', icon: Shrimp, label: 'Shellfish' },
            { id: 'gluten', icon: WheatOff, label: 'Gluten' },
            { id: 'dairy', icon: Milk, label: 'Dairy' },
            { id: 'eggs', icon: Egg, label: 'Eggs' },
            { id: 'halal', icon: BadgeCheck, label: 'Halal' },
            { id: 'vegetarian', icon: Carrot, label: 'Vegetarian' },
            { id: 'vegan', icon: Sprout, label: 'Vegan' },
            { id: 'none', icon: CheckCircle2, label: 'None, I eat everything', exclusive: true },
        ],
    },
];

export const PUBLIC_QUESTION_IDS = ['foods', 'vibe', 'company', 'travel'];
export const PRIVATE_QUESTION_ID = 'dietary';
