import * as Haptics from 'expo-haptics';

// Small, safe wrappers: the haptics native module is missing from some dev builds, and a failed buzz must never break a tap.
export const tapSelect = () => { Haptics.selectionAsync().catch(() => {}); };
export const tapLight = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
