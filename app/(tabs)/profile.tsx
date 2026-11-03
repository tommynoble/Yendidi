import React from 'react';
import { useAppStore } from '@/lib/store';
import ProfileScreen from '@/components/ProfileScreen';
import KitchenSchedule from '@/components/KitchenSchedule';

export default function ProfileTab() {
    const isCookMode = useAppStore(state => state.isCookMode);

    // Kitchen Mode: this tab is the weekly schedule. The profile and settings moved to the avatar (/account).
    if (isCookMode) return <KitchenSchedule />;

    return <ProfileScreen />;
}
