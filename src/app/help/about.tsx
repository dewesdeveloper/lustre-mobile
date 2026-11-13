import { themedStyles } from '@/theme/themedStyles';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openExternalUrl } from '@/utils/openUrl';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import {
  Download,
  Gamepad2,
  Globe,
  Mail,
  MessageSquare,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react-native';

import { L } from '@/constants/lustre';

const INFO_POINTS: { icon: React.ReactNode; color: string; title: string; text: string }[] = [
  {
    icon: <Globe size={20} color={L.accent} />,
    color: L.accent,
    title: 'Что такое Lustre',
    text: 'Единый игровой лаунчер: магазин, библиотека, сообщества, чат и профиль — всё в одном приложении.',
  },
  {
    icon: <Gamepad2 size={20} color={L.violet} />,
    color: L.violet,
    title: 'Каталог и библиотека',
    text: 'Тысячи игр с тегами, отзывами, скриншотами и умными рекомендациями. Всё, что вы добавили, хранится в личной библиотеке.',
  },
  {
    icon: <Download size={20} color="#22D3EE" />,
    color: '#22D3EE',
    title: 'Запуск и загрузки',
    text: 'Быстрая установка, прогресс загрузок и запуск игр в один клик прямо из лаунчера.',
  },
  {
    icon: <Users size={20} color={L.success} />,
    color: L.success,
    title: 'Сообщества и форумы',
    text: 'Общие и игровые форумы, публичные и приватные сообщества по ссылке-приглашению, публикация скриншотов и обсуждений.',
  },
  {
    icon: <MessagesSquare size={20} color="#38BDF8" />,
    color: '#38BDF8',
    title: 'Чат, друзья и звонки',
    text: 'Личные диалоги, статусы «в сети» и «играет в…», заявки в друзья и звонки прямо внутри лаунчера.',
  },
  {
    icon: <Sparkles size={20} color="#FBBF24" />,
    color: '#FBBF24',
    title: 'Кастомизация профиля',
    text: 'Темы оформления, рамки аватара, баннеры и магазин стиля за заработанные плоды изгнания.',
  },
  {
    icon: <Trophy size={20} color="#EAB308" />,
    color: '#EAB308',
    title: 'Достижения и награды',
    text: 'Значки за активность в лаунчере, играх и сообществах — от «Первых шагов» до юбилеев и легендарных наград.',
  },
  {
    icon: <ShieldCheck size={20} color={L.muted} />,
    color: L.muted,
    title: 'Безопасность и данные',
    text: 'Пароли хранятся только в виде хэшей. Прозрачная политика конфиденциальности и защита аккаунта.',
  },
];

const SOCIALS = [
  { name: 'Discord', icon: <MessageSquare size={22} color={L.violet} />, url: 'https://discord.gg/2zEf6hGRDq' },
  { name: 'Почта', icon: <Mail size={22} color={L.accent} />, url: 'mailto:support@lustrehub.com' },
];

export default function AboutScreen() {
  const open = (url: string) => openExternalUrl(url);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Об Lustre</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Шапка */}
        <View style={styles.hero}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Игровая платформа · v0.0.1</Text>
          </View>
          <Text style={styles.heroTitle}>LUSTRE</Text>
          <Text style={styles.heroAccent}>твой игровой хаб</Text>
          <Text style={styles.heroText}>
            Lustre объединяет покупку и запуск игр, общение с игроками и прокачку собственного профиля.
            Ниже — коротко о том, что умеет лаунчер.
          </Text>
        </View>

        {/* Пункты */}
        <View style={styles.list}>
          {INFO_POINTS.map((p, i) => (
            <View key={p.title} style={[styles.point, i === INFO_POINTS.length - 1 && styles.pointLast]}>
              <Text style={styles.pointIndex}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={[styles.pointIcon, { borderColor: L.border }]}>{p.icon}</View>
              <View style={styles.pointBody}>
                <Text style={styles.pointTitle}>{p.title}</Text>
                <Text style={styles.pointText}>{p.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Соцсети */}
        <View style={styles.socials}>
          <Text style={styles.socialsTitle}>Мы на связи</Text>
          <Text style={styles.socialsSub}>Новости, поддержка и общение сообщества</Text>
          <View style={styles.socialsRow}>
            {SOCIALS.map((s) => (
              <Pressable key={s.name} onPress={() => open(s.url)} style={styles.socialBtn}>
                {s.icon}
                <Text style={styles.socialText}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.docLinks}>
          <Pressable onPress={() => router.push('/help/privacy' as Href)} style={styles.docLink}>
            <Text style={styles.docLinkText}>Политика конфиденциальности</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/help/legal' as Href)} style={styles.docLink}>
            <Text style={styles.docLinkText}>Правовая информация</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/help/agreement' as Href)} style={styles.docLink}>
            <Text style={styles.docLinkText}>Соглашение подписчика</Text>
          </Pressable>
        </View>
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
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  hero: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 22,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 0,
    backgroundColor: L.success,
  },
  badgeText: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1.5 },
  heroTitle: {
    color: L.text,
    fontSize: 40, fontFamily: 'Tiny5',
    letterSpacing: -1,
    marginTop: 16,
  },
  heroAccent: {
    color: L.accent,
    fontSize: 18, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  heroText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20, marginTop: 14 },
  list: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    overflow: 'hidden',
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: L.border,
  },
  pointLast: { borderBottomWidth: 0 },
  pointIndex: { color: 'rgba(255,255,255,0.55)', fontSize: 16, fontFamily: 'Tiny5', width: 24 },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointBody: { flex: 1, minWidth: 0 },
  pointTitle: {
    color: L.text,
    fontSize: 13, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pointText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },
  socials: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 18,
    gap: 14,
  },
  socialsTitle: {
    color: L.muted,
    fontSize: 11, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  socialsSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },
  socialsRow: { flexDirection: 'row', gap: 10 },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingVertical: 14,
  },
  socialText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  docLinks: { gap: 8 },
  docLink: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 14,
  },
  docLinkText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
}));
