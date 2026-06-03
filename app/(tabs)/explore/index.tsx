import { Redirect } from 'expo-router';
import { useAppStore } from '@/lib/store';

export default function ExploreIndex() {
    const { isCookMode } = useAppStore();
    return <Redirect href={isCookMode ? '/(tabs)/explore/list' : '/(tabs)/explore/map'} />;
}
