import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <Redirect href="/(tabs)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: L.bg },
      }}
    />
  );
}
