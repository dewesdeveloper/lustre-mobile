import { themedStyles } from '@/theme/themedStyles';
import { GestureResponderEvent, Pressable, View, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import type { BottomTabBarButtonProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { CircleUser, House, LibraryBig, MessageSquare, Store, Users } from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import AdultOfferModal from '@/components/AdultOfferModal';
import { L } from '@/constants/lustre';
import { useAppTheme, withAlpha } from '@/theme/appTheme';

/**
 * Кастомная кнопка вкладки: у дефолтной на Android рисуется borderless-рипл —
 * круглое пятно поверх иконки. Здесь его нет, вместо него — мягкая затоптка.
 * Квадратная обводка активной вкладки рисуется в tabBarIcon (styles.iconBox).
 */
function TabButton(props: BottomTabBarButtonProps) {
  const { children, style, onPress, onLongPress, testID, accessibilityLabel } = props;
  const a11y = props as { accessibilityState?: { selected?: boolean }; 'aria-selected'?: boolean };
  const selected = a11y.accessibilityState?.selected ?? a11y['aria-selected'];
  return (
    <Pressable
      onPress={onPress as (e: GestureResponderEvent) => void}
      onLongPress={onLongPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [style, pressed && styles.tabPressed]}>
      {children}
    </Pressable>
  );
}
TabButton.displayName = 'TabButton';

/** Иконка вкладки: квадратная рамка TL-стиля, у активной — в акценте текущей темы. */
function tabIcon(Icon: typeof House, accent: string) {
  return function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return (
      <View
        style={[
          styles.iconBox,
          focused && { borderColor: accent, backgroundColor: withAlpha(accent, '1f') },
        ]}>
        <Icon size={14} color={String(color)} strokeWidth={2.5} />
      </View>
    );
  };
}

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const theme = useAppTheme();

  if (isLoading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <>
    <AdultOfferModal />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: L.muted,
        tabBarButton: TabButton,
        tabBarLabelStyle: { fontFamily: 'Tiny5', fontSize: 10, lineHeight: 10, letterSpacing: -0.5 },
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor: L.border,
        },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Главная', tabBarIcon: tabIcon(House, theme.accent) }} />
      <Tabs.Screen name="store" options={{ title: 'Магазин', tabBarIcon: tabIcon(Store, theme.accent) }} />
      <Tabs.Screen name="library" options={{ title: 'Библиотека', tabBarIcon: tabIcon(LibraryBig, theme.accent) }} />
      <Tabs.Screen name="chats" options={{ title: 'Чаты', tabBarIcon: tabIcon(MessageSquare, theme.accent) }} />
      <Tabs.Screen name="friends" options={{ title: 'Друзья', tabBarIcon: tabIcon(Users, theme.accent) }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: tabIcon(CircleUser, theme.accent) }} />
    </Tabs>
    </>
  );
}

const styles = themedStyles(() => ({
  tabPressed: { opacity: 0.6 },
  iconBox: {
    minWidth: 34,
    height: 24,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 0,
  },
}));
