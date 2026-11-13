import { themedStyles } from '@/theme/themedStyles';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { router, type Href } from 'expo-router';

import { Button } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';
import { canModerate } from '@/utils/roles';

// Админка — закрытый модуль: экраны src/app/admin/ есть только в официальной сборке
// (npm run admin:pull). В сборке из открытого кода пункта «Админ-панель» нет.
const HAS_ADMIN = require.context('../admin', false, /\.tsx$/).keys().length > 0;

type MenuEntry = { label: string; path: string; admin?: boolean; mod?: boolean };

const MENU: MenuEntry[] = [
  { label: 'Редактировать профиль', path: '/profile/edit' },
  { label: 'Достижения', path: '/profile/badges' },
  { label: 'Активность', path: '/activity' },
  { label: 'Инвентарь', path: '/inventory' },
  { label: 'Внешность', path: '/shop/appearance' },
  { label: 'Косметика', path: '/shop/cosmetics' },
  { label: 'Подписка Lustre Pro', path: '/shop/subscriptions' },
  { label: 'История монет', path: '/shop/history' },
  { label: 'Настройки', path: '/settings' },
  { label: 'Поддержка', path: '/support' },
  { label: 'Помощь и документы', path: '/help/about' },
  { label: 'Модерация', path: '/moderation', mod: true },
  { label: 'Админ-панель', path: '/admin', admin: true },
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const avatar = user.profile?.avatar_url;
  const role = user.role || 'user';
  const isStaff = role === 'admin' || role === 'manager';

  const open = (path: string) => router.push(path as Href);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{(user.username || '?')[0]?.toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{user.profile?.display_name || user.username}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          <Pressable onPress={() => open(`/profile/${user.username}`)} hitSlop={8} style={styles.profileLink}>
            <Text style={styles.profileLinkText}>Открыть профиль</Text>
            <ChevronRight size={14} color={L.muted} />
          </Pressable>
        </View>

        <View style={styles.rows}>
          <Row label="Email" value={user.email} />
          <Row label="Код друга" value={user.friend_code || '—'} />
          <Row label="Уровень" value={String(user.profile?.level ?? 0)} />
        </View>

        <View style={styles.rows}>
          {MENU.filter((m) => (!m.admin || (isStaff && HAS_ADMIN)) && (!m.mod || canModerate(role))).map((m) => (
            <Pressable
              key={m.path}
              onPress={() => open(m.path)}
              style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
            >
              <Text style={styles.menuLabel}>{m.label}</Text>
              <ChevronRight size={16} color={L.muted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Button title="Безопасность" onPress={() => open('/two-factor')} variant="ghost" />
          <Button title="Выйти" onPress={() => void logout()} variant="ghost" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  container: { padding: 24, paddingBottom: 48, gap: 20 },
  header: { alignItems: 'center', marginTop: 16 },
  avatar: { width: 96, height: 96, borderRadius: 0, backgroundColor: L.card },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: L.text, fontSize: 36, fontFamily: 'Tiny5', },
  name: { color: L.text, fontSize: 20, fontFamily: 'Tiny5', marginTop: 14 },
  username: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },
  profileLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, minHeight: 28 },
  profileLinkText: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  rows: { gap: 1, backgroundColor: L.card, borderRadius: 0, overflow: 'hidden', borderWidth: 1, borderColor: L.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: L.border },
  rowLabel: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  rowValue: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: L.border,
  },
  menuLabel: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', fontWeight: '600', flex: 1, marginRight: 8 },
  pressed: { opacity: 0.6 },
  actions: { gap: 8 },
}));
