import React from 'react';
import ProfileScreen from '@/components/ProfileScreen';

// Profile and settings as its own screen. Kitchen Mode opens it from the avatar on the dashboard.
export default function AccountScreen() {
  return <ProfileScreen showBack />;
}
