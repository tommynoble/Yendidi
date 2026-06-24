export const DISH_IMAGES: Record<string, any> = {
    'jollof rice': require('../assets/images/dishes/jollof_rice_chicken.jpg'),
    'jollof rice with chicken': require('../assets/images/dishes/jollof_rice_chicken.jpg'),
    'jollof rice with grilled chicken': require('../assets/images/dishes/jollof_rice_chicken.jpg'),
    'waakye': require('../assets/images/dishes/waakye_special.jpg'),
    'waakye special': require('../assets/images/dishes/waakye_special.jpg'),
    'banku & tilapia': require('../assets/images/dishes/banku_tilapia.jpg'),
    'banku and tilapia': require('../assets/images/dishes/banku_tilapia.jpg'),
    'banku & okro': require('../assets/images/dishes/banku_and_okro.jpg'),
    'banku and okro': require('../assets/images/dishes/banku_and_okro.jpg'),
    'fufu & light soup': require('../assets/images/dishes/fufu_light_soup.jpg'),
    'fufu and light soup': require('../assets/images/dishes/fufu_light_soup.jpg'),
    'red red': require('../assets/images/dishes/red_red_gob3.jpg'),
    'red red (gob3)': require('../assets/images/dishes/red_red_gob3.jpg'),
    'emo tuo & groundnut soup': require('../assets/images/dishes/emo_tuo_with_groundutsoup.jpg'),
    'emo tuo and groundnut soup': require('../assets/images/dishes/emo_tuo_with_groundutsoup.jpg'),
    'kelewele': require('../assets/images/dishes/kelewele.jpg'),
    'fried rice': require('../assets/images/dishes/fried_rice.jpg'),
    'ampesi': require('../assets/images/dishes/ampesi.jpg'),
    'kenkey & fish': require('../assets/images/dishes/kenkey_and_fish.jpg'),
    'kenkey and fried fish': require('../assets/images/dishes/kenkey_and_fish.jpg'),
    'kenkey and fish': require('../assets/images/dishes/kenkey_and_fish.jpg'),
    'tuo zaafi (tz)': require('../assets/images/dishes/emo_tuo_with_groundutsoup.jpg'), // Fallback to similar-looking soup if TZ image missing
    'gari foto': require('../assets/images/dishes/jollof_rice_chicken.jpg'), // Fallback
};

export const getDishImage = (name: string, fallbackUrl?: string | null) => {
    // Extract first URL if fallbackUrl contains commas
    const firstUrl = fallbackUrl && fallbackUrl.includes(',')
        ? fallbackUrl.split(',')[0].trim()
        : fallbackUrl;

    // Filter out Unsplash or placeholder URLs
    const isUnsplashOrPlaceholder = firstUrl && (
        firstUrl.includes('unsplash.com') || 
        firstUrl.includes('placeholder') || 
        firstUrl.includes('via.placeholder')
    );
    const safeUrl = isUnsplashOrPlaceholder ? null : firstUrl;

    if (name) {
        const lowerName = name.toLowerCase().trim();
        // Try exact match or partial match
        for (const [key, asset] of Object.entries(DISH_IMAGES)) {
            if (lowerName === key || lowerName.includes(key) || key.includes(lowerName)) {
                return asset;
            }
        }
    }

    if (safeUrl) {
        return { uri: safeUrl };
    }

    // Default to a premium local asset (Ghanaian Jollof Rice) if no custom user upload and no match
    return require('../assets/images/dishes/jollof_rice_chicken.jpg');
};
