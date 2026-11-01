// YenDidii colour system — the four core colours from the "YenDidii Redesign" panel.
// Import these instead of typing hex values, e.g. `import { palette } from '@/constants/theme'`.
// (Not applied to screens yet; existing screens still use their own hex values.)
export const palette = {
    /** page background — the blush pink behind every screen (Home, tab bar, Explore, dish page) */
    canvas: '#F8E4DD',
    /** soft warm off-white — cards and light surfaces */
    surface: '#FBF5F2',
    /** deep brown — primary text and headings */
    ink: '#3D251E',
    /** burnt orange — buttons, links, icons, highlights */
    accent: '#C25327',
    /** ink at 70% — softer icons (tab bar, top bar); about 4.9:1 on canvas and 5.4:1 on surface */
    inkSoft: 'rgba(61, 37, 30, 0.7)',
    /** loading-skeleton blocks — a clearly visible tan on both canvas and surface */
    skeleton: '#DDC1B6',
    /** ink at 5% — the soft gray-brown wash behind icon buttons */
    inkWash: 'rgba(61, 37, 30, 0.05)',
    /** muted brown — secondary labels (4.8:1 contrast on the surface colour) */
    muted: '#7A5C53',
} as const;

export type PaletteColor = keyof typeof palette;

// ---------------------------------------------------------------------------
// Typography — Plus Jakarta Sans, 16px base. Spread a role into a style:
//   <Text style={type.body}>…</Text>     <Text style={[type.section, { color: palette.ink }]}>…</Text>
// (Not applied to screens yet; existing screens still set their own sizes.)
// ---------------------------------------------------------------------------
export const fonts = {
    regular: 'PlusJakartaSans_400Regular',
    medium: 'PlusJakartaSans_500Medium',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const type = {
    /** page header / top titles — 24 / 30, bold */
    hero: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
    /** section headings ("Upcoming Gatherings", "Who's at the Table") — 20 / 26, bold */
    section: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
    /** card titles: dish name, host name — 16 / 22, semibold (use fonts.bold for extra emphasis) */
    card: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
    /** body text: course descriptions, requests — 14 / 20, regular */
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
    /** secondary metadata: locations, attendees — 12 / 16, medium */
    meta: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
    /** micro labels: category pills, seat badges, tab bar — 11 / 14, semibold */
    micro: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
    /** dish name on the small cards — 14 / 20, bold (one step below `card`). Change it here and every use updates. */
    cardTitleSmall: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
} as const;

export type TypeRole = keyof typeof type;
