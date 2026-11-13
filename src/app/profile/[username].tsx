import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import api from '@/api/client';
import { getOrCreateConversation } from '@/api/chat';
import { sendFriendRequest } from '@/api/friends';
import { getPresence, usePresenceVersion } from '@/api/presence';
import WallComments from '@/components/profile/WallComments';
import { L } from '@/constants/lustre';
import { useAuth } from '@/context/AuthContext';
import { canModerate } from '@/utils/roles';

interface ProfileData {
  display_name?: string;
  bio?: string;
  tag?: string;
  tags?: string;
  tag_color?: string;
  avatar_url?: string;
  avatar_frame_url?: string;
  banner_url?: string;
  level?: number;
  xp?: number;
  is_pro?: boolean;
}

interface ViewedUser {
  id: number;
  username: string;
  role?: string;
  online_status?: string;
  member_since?: string;
  profile?: ProfileData;
  stats?: {
    games?: number;
    favorites?: number;
    achievements?: number;
    friends?: number;
    playtime_ms?: number;
    level?: number;
    level_xp?: number;
    level_goal?: number;
  };
  viewer?: { is_friend?: boolean; can_dm?: boolean; can_call?: boolean; can_friend_request?: boolean };
  private?: boolean;
}

const nf = new Intl.NumberFormat('ru-RU');

const fmtHours = (ms?: number) => (ms && ms >= 3600000 ? `${nf.format(Math.floor(ms / 3600000))} ч` : '—');

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Заголовки профиля (титулы) из JSON-строки profile.tags. */
function parseTitles(raw?: string): { text: string; color?: string }[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((t) => (typeof t === 'string' ? { text: t } : { text: t?.text, color: t?.color }))
      .filter((t) => !!t.text)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  usePresenceVersion();

  const [data, setData] = useState<ViewedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);
    api
      .get(`/user/${encodeURIComponent(username)}`)
      .then((res) => setData(res.data as ViewedUser))
      .catch((err: { response?: { status?: number } }) => {
        if (err?.response?.status === 403) setData({ id: 0, username, private: true });
        else if (err?.response?.status === 404) setNotFound(true);
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [username]);

  useFocusEffect(load);

  const openChat = async () => {
    if (!data?.id) return;
    try {
      const convId = await getOrCreateConversation(data.id);
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: String(convId),
          username: data.profile?.display_name || data.username,
          otherId: String(data.id),
          avatar: data.profile?.avatar_url || '',
        },
      });
    } catch {
      // игнорируем
    }
  };

  const addFriend = async () => {
    if (!data?.id) return;
    setBusy(true);
    try {
      await sendFriendRequest({ friend_id: data.id });
      setRequested(true);
    } catch {
      // игнорируем
    } finally {
      setBusy(false);
    }
  };

  const Header = (
    <View style={styles.topbar}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <Text style={styles.topbarTitle} numberOfLines={1}>Профиль</Text>
      <View style={styles.backBtn} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {Header}
        <ActivityIndicator color={L.accent} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (notFound || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {Header}
        <View style={styles.center}>
          <Text style={styles.centerText}>Пользователь не найден</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (data.private) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {Header}
        <View style={styles.center}>
          <Text style={styles.centerTitle}>Профиль скрыт</Text>
          <Text style={styles.centerText}>Пользователь ограничил круг лиц, которым виден его профиль.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const profile = data.profile || {};
  const displayName = profile.display_name || data.username;
  const stats = data.stats || {};
  const level = stats.level ?? profile.level ?? 1;
  const levelXp = stats.level_xp ?? 0;
  const levelGoal = stats.level_goal || 30;
  const levelPct = Math.max(0, Math.min(100, Math.round((levelXp / Math.max(1, levelGoal)) * 100)));
  const presence = getPresence(data.id);
  const online = presence?.online ?? data.online_status === 'online';
  const titles = parseTitles(profile.tags);
  const canDm = data.viewer?.can_dm ?? data.viewer?.is_friend ?? false;
  const isFriend = !!data.viewer?.is_friend;
  const canRequest = !isFriend && (data.viewer?.can_friend_request ?? true);
  const isOwn = !username || username === currentUser?.username;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {Header}
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Баннер */}
        <View style={styles.banner}>
          {profile.banner_url ? <Image source={{ uri: profile.banner_url }} style={styles.bannerImg} /> : null}
          <View style={styles.bannerShade} />
        </View>

        {/* Аватар + имя */}
        <View style={styles.headRow}>
          <View style={styles.avatarWrap}>
            {profile.avatar_frame_url || profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_frame_url || profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{(data.username || '?')[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
          </View>
          <View style={styles.headInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
              {profile.is_pro ? <Text style={styles.proChip}>PRO</Text> : null}
              {data.role === 'admin' ? <Text style={styles.adminChip}>ADMIN</Text> : null}
            </View>
            <Text style={styles.uname} numberOfLines={1}>@{data.username}</Text>
            <Text style={[styles.onlineText, online && styles.onlineTrue]} numberOfLines={1}>
              {presence?.playing ? `Играет в ${presence.playing}` : online ? 'В сети' : 'Не в сети'}
            </Text>
          </View>
        </View>

        {/* Уровень */}
        <View style={styles.levelCard}>
          <View style={styles.levelHead}>
            <Text style={styles.levelLabel}>УРОВЕНЬ {level}</Text>
            <Text style={styles.levelXp}>{nf.format(levelXp)} / {nf.format(levelGoal)} XP</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${levelPct}%` }]} />
          </View>
        </View>

        {/* Титулы */}
        {titles.length > 0 && (
          <View style={styles.titles}>
            {titles.map((t, i) => (
              <Text
                key={`${t.text}-${i}`}
                style={[styles.titleChip, { color: t.color || L.accent, borderColor: `${t.color || L.accent}66` }]}>
                {t.text}
              </Text>
            ))}
          </View>
        )}

        {/* О себе */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>О себе</Text>
          <Text style={styles.bio}>{profile.bio || 'Пользователь пока ничего не рассказал о себе.'}</Text>
        </View>

        {/* Статистика */}
        <View style={styles.stats}>
          <Stat value={nf.format(stats.games ?? 0)} label="Игр" />
          <Stat value={nf.format(stats.friends ?? 0)} label="Друзей" />
          <Stat value={nf.format(stats.achievements ?? 0)} label="Значков" />
          <Stat value={fmtHours(stats.playtime_ms)} label="Наиграно" />
        </View>

        <Text style={styles.since}>В Lustre с {fmtDate(data.member_since)}</Text>

        {/* Действия */}
        <View style={styles.actions}>
          {canDm && (
            <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={() => void openChat()}>
              <Text style={styles.actionPrimaryText}>Написать</Text>
            </Pressable>
          )}
          {canRequest && (
            <Pressable
              style={[styles.actionBtn, styles.actionGhost, (busy || requested) && styles.disabled]}
              disabled={busy || requested}
              onPress={() => void addFriend()}>
              <Text style={styles.actionGhostText}>
                {requested ? 'Заявка отправлена' : busy ? 'Отправка…' : 'Добавить в друзья'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Разделы профиля (только свой профиль) */}
        {isOwn && (
          <View style={styles.links}>
            <LinkRow
              label="Редактировать профиль"
              onPress={() => router.push('/profile/edit' as Href)}
            />
            <LinkRow label="Достижения" onPress={() => router.push('/profile/badges' as Href)} />
            <LinkRow label="Активность" onPress={() => router.push('/activity' as Href)} />
            <LinkRow label="Инвентарь" onPress={() => router.push('/inventory' as Href)} />
          </View>
        )}

        {/* Стена профиля */}
        <WallComments profileId={data.id} canDelete={isOwn || canModerate(currentUser?.role)} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, pressed && styles.linkRowPressed]}>
      <Text style={styles.linkLabel}>{label}</Text>
      <ChevronRight size={16} color={L.muted} />
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  loader: { marginTop: 60 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: L.text, fontSize: 22, fontFamily: 'Tiny5', },
  topbarTitle: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  centerTitle: { color: L.text, fontSize: 18, fontFamily: 'Tiny5', },
  centerText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', lineHeight: 20 },

  container: { paddingBottom: 48 },

  banner: { height: 140, backgroundColor: '#121017' },
  bannerImg: { width: '100%', height: '100%' },
  bannerShade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,8,10,0.35)' },

  headRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, marginTop: -34 },
  avatarWrap: { width: 92, height: 92 },
  avatar: { width: 92, height: 92, borderRadius: 0, borderWidth: 3, borderColor: L.accent, backgroundColor: L.card },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: L.text, fontSize: 34, fontFamily: 'Tiny5', },
  dot: { position: 'absolute', right: 2, bottom: 2, width: 16, height: 16, borderRadius: 0, borderWidth: 3, borderColor: L.bg },
  dotOnline: { backgroundColor: L.success },
  dotOffline: { backgroundColor: L.muted },
  headInfo: { flex: 1, minWidth: 0, gap: 4, paddingTop: 40 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: L.text, fontSize: 20, fontFamily: 'Tiny5', flexShrink: 1 },
  proChip: { color: '#0b0210', backgroundColor: L.accent, fontSize: 10, fontFamily: 'Tiny5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 0, overflow: 'hidden' },
  adminChip: { color: L.violet, borderWidth: 1, borderColor: `${L.violet}66`, fontSize: 10, fontFamily: 'Tiny5', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 0 },
  uname: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  onlineText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  onlineTrue: { color: L.success },

  levelCard: { marginHorizontal: 20, marginTop: 18, backgroundColor: L.card, borderWidth: 1, borderColor: L.border, borderRadius: 0, padding: 14, gap: 8 },
  levelHead: { flexDirection: 'row', justifyContent: 'space-between' },
  levelLabel: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 1 },
  levelXp: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  progressTrack: { height: 6, borderRadius: 0, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: L.accent },

  titles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 16 },
  titleChip: { fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, borderWidth: 1, borderRadius: 0, paddingHorizontal: 10, paddingVertical: 4 },

  section: { paddingHorizontal: 20, marginTop: 20, gap: 8 },
  sectionTitle: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 2 },
  bio: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 21 },

  stats: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20 },
  statTile: { flex: 1, backgroundColor: L.card, borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingVertical: 14, alignItems: 'center' },
  statValue: { color: L.accent, fontSize: 18, fontFamily: 'Tiny5', },
  statLabel: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },

  since: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginTop: 20 },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 20 },
  actionBtn: { flex: 1, borderRadius: 0, paddingVertical: 14, alignItems: 'center' },
  actionPrimary: { backgroundColor: L.accent },
  actionPrimaryText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  actionGhost: { borderWidth: 1, borderColor: L.borderStrong },
  actionGhostText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  disabled: { opacity: 0.5 },

  links: {
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: L.border,
  },
  linkRowPressed: { backgroundColor: L.cardAlt },
  linkLabel: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
}));
