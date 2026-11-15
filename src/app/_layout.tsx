import { useEffect } from 'react';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ConnectivityProvider } from '@/context/ConnectivityContext';
import { useChatConnection } from '@/hooks/use-chat';
import { useCallManager, useGroupCallManager } from '@/hooks/use-call';
import { usePresenceManager } from '@/api/presence';
import { setProStatus } from '@/api/mediaQuality';
import { setupIncomingCall } from '@/api/incomingCall';
import { usePushRegistration, useNotificationObserver } from '@/hooks/use-push';
import { configureNotificationHandler } from '@/api/push';
import CallOverlay from '@/components/CallOverlay';
import GroupCallOverlay from '@/components/GroupCallOverlay';
import OfflineBanner from '@/components/OfflineBanner';
import UpdatePrompt from '@/components/UpdatePrompt';
import VoiceBar from '@/components/voice/VoiceBar';
import { initVoiceChannels } from '@/api/voiceChannel';
import { setLauncherThemeById, useAppTheme } from '@/theme/appTheme';

// Держим нативный сплэш, пока не загрузятся TL-шрифты (Tiny5 + JetBrains Mono).
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Обработчик уведомлений нужно поставить до первого уведомления
configureNotificationHandler();

function ChatBootstrap() {
  const { user } = useAuth();
  useChatConnection();
  useCallManager();
  useGroupCallManager();
  usePresenceManager();
  usePushRegistration();
  useNotificationObserver();

  // Тема лаунчера из профиля — перекрашивает приложение при старте и смене аккаунта
  useEffect(() => {
    setLauncherThemeById(user?.profile?.launcher_theme_id || null);
  }, [user]);
  // Качество звонков: Pro → HD (1080p/60), остальные → SD (720p/30).
  useEffect(() => {
    setProStatus(!!user?.profile?.is_pro);
  }, [user?.profile?.is_pro]);
  // Голосовые каналы сообществ: события voice.* по WS (после входа)
  useEffect(() => {
    if (user?.id) initVoiceChannels(user.id);
  }, [user?.id]);
  // Полноэкранный входящий звонок (Android, notifee + фоновая задача)
  useEffect(() => {
    void setupIncomingCall();
  }, []);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Пиксельный шрифт — Tiny5 (полная кириллица; Press Start 2P плохо читался). Лицензия OFL — assets/fonts/Tiny5-OFL.txt
    Tiny5: require('../../assets/fonts/Tiny5.ttf'),
    JetBrainsMono_400Regular: require('@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf'),
    JetBrainsMono_700Bold: require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf'),
  });
  const theme = useAppTheme();

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={DarkTheme}>
        <ConnectivityProvider>
          <AuthProvider>
            <ChatBootstrap />
            <StatusBar style="light" />
            <OfflineBanner />
            <VoiceBar />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: theme.bg },
              }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
            <CallOverlay />
            <GroupCallOverlay />
            <UpdatePrompt />
          </AuthProvider>
        </ConnectivityProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
