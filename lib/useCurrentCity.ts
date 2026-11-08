import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';

// Short codes for the places people are most likely to be in. Anything not listed falls back to the city alone,
// so we never show a made-up two-letter code.
const COUNTRY_CODES: Record<string, string> = {
    GHANA: 'GH', NIGERIA: 'NG', 'UNITED STATES': 'US', 'UNITED KINGDOM': 'UK', CANADA: 'CA', KENYA: 'KE',
    'SOUTH AFRICA': 'ZA', 'COTE D\'IVOIRE': 'CI', TOGO: 'TG', SENEGAL: 'SN', FRANCE: 'FR', GERMANY: 'DE',
};
// US state names, so a saved "City, State" address still reads as "CITY, US".
const US_STATE_CODES: Record<string, string> = {
    ALABAMA: 'AL', ALASKA: 'AK', ARIZONA: 'AZ', ARKANSAS: 'AR', CALIFORNIA: 'CA', COLORADO: 'CO', CONNECTICUT: 'CT',
    DELAWARE: 'DE', FLORIDA: 'FL', GEORGIA: 'GA', HAWAII: 'HI', IDAHO: 'ID', ILLINOIS: 'IL', INDIANA: 'IN', IOWA: 'IA',
    KANSAS: 'KS', KENTUCKY: 'KY', LOUISIANA: 'LA', MAINE: 'ME', MARYLAND: 'MD', MASSACHUSETTS: 'MA', MICHIGAN: 'MI',
    MINNESOTA: 'MN', MISSISSIPPI: 'MS', MISSOURI: 'MO', MONTANA: 'MT', NEBRASKA: 'NE', NEVADA: 'NV', 'NEW HAMPSHIRE': 'NH',
    'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', OHIO: 'OH',
    OKLAHOMA: 'OK', OREGON: 'OR', PENNSYLVANIA: 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC', 'SOUTH DAKOTA': 'SD',
    TENNESSEE: 'TN', TEXAS: 'TX', UTAH: 'UT', VERMONT: 'VT', VIRGINIA: 'VA', WASHINGTON: 'WA', 'WEST VIRGINIA': 'WV',
    WISCONSIN: 'WI', WYOMING: 'WY',
};

// "Accra, Ghana" -> "ACCRA, GH"; "San Francisco, California" -> "SAN FRANCISCO, US". Used for a saved address string.
export function formatLocationLabel(full?: string | null): string {
    if (!full) return 'ACCRA, GH';
    const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return 'ACCRA, GH';
    const city = parts[0].toUpperCase();
    if (parts.length === 1) return city;
    const region = parts[1].toUpperCase();
    const code = region.length <= 3 ? region : COUNTRY_CODES[region] || (US_STATE_CODES[region] ? 'US' : undefined);
    return code ? `${city}, ${code}` : city;
}

// Label for where the user is right now, from the phone's location: "ACCRA, GH" or "SAN FRANCISCO, US".
// Returns null when location permission isn't granted or the place can't be worked out, so the caller can fall back
// to a saved address. It never prompts: the permission is asked for during onboarding.
async function fetchCurrentCity(): Promise<string | null> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const position =
        (await Location.getLastKnownPositionAsync()) ||
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!position) return null;

    const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
    });
    if (!place) return null;

    const city = (place.city || place.subregion || place.district || place.region || '').toUpperCase();
    if (!city) return null;
    const code = (place.isoCountryCode || '').toUpperCase();
    return code ? `${city}, ${code}` : city;
}

export function useCurrentCity(enabled = true) {
    return useQuery({
        queryKey: ['current-city'],
        queryFn: fetchCurrentCity,
        enabled,
        staleTime: 10 * 60 * 1000,
        retry: false,
    });
}
