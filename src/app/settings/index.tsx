import { themedStyles } from '@/theme/themedStyles';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import {
  Cloud,
  EyeOff,
  Headphones,
  Image as ImageIcon,
  Library,
  LifeBuoy,
  Monitor,
  Shield,
  Store,
  User,
} from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { Avatar, Row } from '@/components/settings/ui';
import { L } from '@/constants/lustre';

type SectionDef = {
  key: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  href?: string;
  disabled?: boolean;
};

const SECTIONS: SectionDef[] = [
  { key: 'account', label: 'Аккаунт', hint: 'Данные аккаунта, выход, удаление', icon: <User size={18} color={L.accent} />, href: '/settings/account' },
  { key: 'security', label: 'Безопасность', hint: 'Пароль, 2FA, доверенные устройства', icon: <Shield size={18} color={L.violet} />, href: '/settings/security' },
  { key: 'privacy', label: 'Конфиденциальность', hint: 'Кто видит профиль, заявки, звонки', icon: <EyeOff size={18} color={L.muted} />, href: '/settings/privacy' },
  { key: 'interface', label: 'Интерфейс', hint: 'Уведомления и отображение', icon: <Monitor size={18} color={L.muted} />, href: '/settings/interface' },
  { key: 'cloud', label: 'Хранилище', hint: '', icon: <Cloud size={18} color={L.muted} />, disabled: true },
  { key: 'audio', label: 'Голос', hint: '', icon: <Headphones size={18} color={L.muted} />, disabled: true },
  { key: 'background', label: 'Фон лаунчера', hint: '', icon: <ImageIcon size={18} color={L.muted} />, disabled: true },
  { key: 'library', label: 'Библиотека', hint: '', icon: <Library size={18} color={L.muted} />, disabled: true },
  { key: 'store', label: 'Магазин', hint: '', icon: <Store size={18} color={L.muted} />, disabled: true },
  { key: 'help', label: 'Помощь', hint: 'Поддержка, частые вопросы', icon: <LifeBuoy size={18} color={L.accent} />, href: '/support' },
];

export default function SettingsHubScreen() {
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Настройки</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.userCard}>
          <Avatar url={user?.profile?.avatar_url} name={user?.username} size={48} />
          <View style={styles.userBody}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.profile?.display_name || user?.username || 'Гость'}
            </Text>
            <Text style={styles.userLogin} numberOfLines={1}>
              {user ? `@${user.username}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          {SECTIONS.map((s, i) => (
            <Row
              key={s.key}
              label={s.label}
              hint={s.hint || undefined}
              icon={s.icon}
              disabled={s.disabled}
              last={i === SECTIONS.length - 1}
              onPress={s.href ? () => router.push(s.href as Href) : undefined}
            />
          ))}
        </View>

        <Text style={styles.footer}>Настройки применяются автоматически</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 16,
  },
  userBody: { flex: 1, minWidth: 0 },
  userName: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },
  userLogin: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  card: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  footer: {
    color: L.success,
    fontSize: 11, fontFamily: 'JetBrainsMono_700Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
}));
