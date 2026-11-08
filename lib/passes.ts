import { ImageSourcePropType } from 'react-native';

export type PassDetail = { icon: 'calendar' | 'pin' | 'ticket'; text: string };

export type Pass = {
    id: string;
    /** card + page label, e.g. "Early Bird" */
    tag: string;
    title: string;
    /** line on the card, under the title */
    subtitle: string;
    /** button text on the card */
    cta: string;
    image?: ImageSourcePropType;
    imageUrl?: string;
    /** card photo placement, see FeatureCard */
    anchor?: 'cover' | 'top-right' | 'logo';
    /** background colour behind a logo (anchor 'logo') */
    bgColor?: string;
    /** paragraph on the pass page */
    about: string;
    details?: PassDetail[];
    /** the one real action on the page: an official link. Without it the page shows "more details coming soon". */
    link?: { label: string; url: string };
};

// Exclusive YenDidii Passes. Only confirmed facts go in here. Add `link`, `details` and a fuller `about` as each one is confirmed.
export const PASSES: Pass[] = [
    {
        id: 'sarkodie-o2',
        tag: 'Early Bird',
        title: 'Join Sarkodie at The O2',
        subtitle: 'Rapperholic UK, Sat 6 March 2027, London. Grab the early-bird discount.',
        cta: 'Get Early Bird',
        image: require('@/assets/images/sarkodie-o2.jpg'),
        anchor: 'top-right',
        about:
            "Sarkodie headlines Rapperholic UK, Ghana's 70th Independence Day celebration at The O2 Arena in London. Official tickets are sold through The O2 and its ticketing partner AXS.",
        details: [
            { icon: 'calendar', text: 'Saturday 6 March 2027, doors 6:30 PM' },
            { icon: 'pin', text: 'The O2 Arena, London' },
            { icon: 'ticket', text: 'Official tickets from £43.75, booking fee included' },
        ],
        link: {
            label: 'Get Tickets on The O2',
            url: 'https://www.theo2.co.uk/events/detail/rapperholic-uk-ghanas-70th-independence-day',
        },
    },
    {
        id: 'pjkev-flights',
        tag: 'PJKEV Approved',
        title: 'Fly with PJKEV',
        subtitle: 'Travel to the show on flights approved by PJKEV.',
        cta: 'Book Flights',
        image: require('@/assets/images/pjkev-flight.jpg'),
        anchor: 'top-right',
        about: 'Travel to the show on flights approved by PJKEV. Full details are coming soon.',
    },
    {
        id: 'detty-december',
        tag: 'Detty December',
        title: 'Detty December in Accra',
        subtitle: 'Dinners, concerts and parties across the city from mid-December into the new year.',
        cta: 'Plan Your Trip',
        image: require('@/assets/images/detty-december.jpg'),
        anchor: 'top-right',
        about:
            'Detty December fills Accra with dinners, concerts and parties from mid-December into the new year. Dates and line-ups change, so check each organizer before you plan your trip.',
        details: [
            { icon: 'calendar', text: 'Mid-December into early January' },
            { icon: 'pin', text: 'Accra, Ghana' },
        ],
    },
    {
        id: 'mefie-discounts',
        tag: 'Partner Deal',
        title: 'Get Discounts from Mefie',
        subtitle: 'Exclusive discounts for YenDidii guests.',
        cta: 'Get Discounts',
        image: require('@/assets/images/mefie-logo.png'),
        anchor: 'logo',
        bgColor: '#2B3B58',
        about: 'Exclusive discounts from Mefie for YenDidii guests. Full details are coming soon.',
    },
];

export const getPass = (id?: string | string[]) => PASSES.find((p) => p.id === (Array.isArray(id) ? id[0] : id));
