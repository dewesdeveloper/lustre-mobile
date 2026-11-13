import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,

  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';

import api from '@/api/client';
import { getOrCreateConversation } from '@/api/chat';
import { getFriends, type Friend } from '@/api/friends';
import { getPresence, usePresenceVersion } from '@/api/presence';
import PlayingCover from '@/components/PlayingCover';
import { getMiniProfile, type MiniProfile } from '@/api/miniProfile';
import { getRecommendations, type RecGame } from '@/api/recommendations';
import { getActivityFeed, type ActivityItem, type ActivityKind } from '@/api/activity';
import { getNews, type NewsItem } from '@/api/news';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';

interface LibraryEntry {
  id: number;
  game_id?: number;
  favorite?: boolean;
  playtime_ms?: number;
  last_played_at?: string;
  game?: {
    ID?: number;
    title?: string;
    developer?: string;
    header_image?: string;
    banner_url?: string;
    age_rating?: string;
  };
}

const ACTIVITY_VERB: Record<ActivityKind, string> = {
  library_add: 'добавил(а) в библиотеку',
  favorite: 'добавил(а) в избранное',
  badge_earned: 'получил(а) значок',
  comment: 'оставил(а) комментарий',
  follow: 'подписался(ась) на',
  group: 'создал(а) группу',
  review: 'оставил(а) отзыв',
  title_equip: 'надел(а) титул',
  level_up: 'вышел(а) на уровень',
};

const nf = new Intl.NumberFormat('ru-RU');

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

const hours = (ms?: number) => (ms && ms >= 3600000 ? `${nf.format(Math.floor(ms / 3600000))} ч` : '—');

function relTime(iso?: string): string {
  if (!iso) return 'недавно';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'вчера' : `${d} дн назад`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const { user } = useAuth();
  usePresenceVersion();

  const [mini, setMini] = useState<MiniProfile | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [recs, setRecs] = useState<RecGame[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const username = user?.username;

  const load = useCallback(async () => {
    if (!username) return;
    const [miniRes, libRes, friendsRes, recsRes, actRes, newsRes] = await Promise.allSettled([
      getMiniProfile(username),
      api.get('/library/').then((r) => (Array.isArray(r.data) ? (r.data as LibraryEntry[]) : [])),
      getFriends(),
      getRecommendations('all'),
      getActivityFeed(4),
      getNews(),
    ]);
    if (miniRes.status === 'fulfilled') setMini(miniRes.value);
    if (libRes.status === 'fulfilled') setLibrary(libRes.value);
    if (friendsRes.status === 'fulfilled') setFriends(friendsRes.value);
    if (recsRes.status === 'fulfilled') setRecs(recsRes.value);
    if (actRes.status === 'fulfilled') setActivity(actRes.value);
    if (newsRes.status === 'fulfilled') setNews(newsRes.value.slice(0, 3));
  }, [username]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void load().finally(() => {
        if (alive) setLoading(false);
      });
      return () => {
        alive = false;
      };
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const openChat = async (friend: Friend) => {
    const userId = friend.friend_details?.id;
    if (!userId) return;
    try {
      const convId = await getOrCreateConversation(userId);
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: String(convId),
          username: friend.friend_details?.username || 'Чат',
          otherId: String(userId),
          avatar: friend.friend_details?.profile?.avatar_url || '',
        },
      });
    } catch {
      // игнорируем — чат не открылся
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={L.accent} style={styles.loader} />
      </SafeAreaView>
    );
  }

  const displayName = user?.profile?.display_name || user?.username || 'игрок';
  const isPro = !!user?.profile?.is_pro;
  const onlineFriends = friends.filter((f) => getPresence(f.friend_details?.id)?.online);
  const lastGame = library[0];
  const level = mini?.level ?? user?.profile?.level ?? 1;
  const levelXp = mini?.level_xp ?? user?.profile?.xp ?? 0;
  const levelGoal = mini?.level_goal || 30;
  const levelPct = Math.max(0, Math.min(100, Math.round((levelXp / Math.max(1, levelGoal)) * 100)));
  const gamesCount = mini?.stats?.games ?? library.length;
  const playtimeMs = mini?.stats?.playtime_ms ?? library.reduce((s, e) => s + (e.playtime_ms || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={L.accent} />}>

        {/* ===== ПРИВЕТСТВИЕ ===== */}
        <View style={styles.greet}>
          <Text style={styles.kicker}>{'// LUSTRE · CYBER LOUNGE'}</Text>
          <Text style={styles.hello}>
            ПРИВЕТ, <Text style={styles.helloAccent}>{displayName.toUpperCase()}</Text>
          </Text>
          <Text style={styles.greetSub}>
            В сети <Text style={styles.online}>{onlineFriends.length}</Text>{' '}
            {plural(onlineFriends.length, 'друг', 'друга', 'друзей')} · {nf.format(gamesCount)}{' '}
            {plural(gamesCount, 'игра', 'игры', 'игр')} в библиотеке
          </Text>
          <View style={styles.greetActions}>
            <Pressable style={styles.btn} onPress={() => router.push('/library' as Href)}>
              <Text style={styles.btnText}>Библиотека</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.push('/store' as Href)}>
              <Text style={styles.btnGhostText}>Магазин</Text>
            </Pressable>
          </View>
        </View>

        {/* ===== ПРОДОЛЖИТЬ ===== */}
        {lastGame ? (
          <Pressable
            style={styles.continue}
            onPress={() => lastGame.game_id && router.push(`/game/${lastGame.game_id}` as Href)}>
            {lastGame.game?.banner_url || lastGame.game?.header_image ? (
              <Image source={{ uri: lastGame.game?.banner_url || lastGame.game?.header_image }} style={styles.continueImg} />
            ) : (
              <View style={[styles.continueImg, styles.continueFallback]} />
            )}
            <View style={styles.continueOverlay}>
              <Text style={styles.continueKicker}>{'// ПРОДОЛЖИТЬ · '}{relTime(lastGame.last_played_at)}</Text>
              <Text style={styles.continueTitle} numberOfLines={1}>
                {lastGame.game?.title || 'Игра'}
              </Text>
              <View style={styles.continueMeta}>
                <Text style={styles.continueMetaText}>{hours(lastGame.playtime_ms)} в игре</Text>
                {lastGame.game?.age_rating ? <Text style={styles.chipAge}>{lastGame.game.age_rating}</Text> : null}
                {lastGame.favorite ? <Text style={styles.chipOk}>В ИЗБРАННОМ</Text> : null}
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Библиотека пуста</Text>
            <Text style={styles.emptyText}>Добавьте первую игру из магазина — она появится здесь.</Text>
            <Pressable style={styles.btn} onPress={() => router.push('/store' as Href)}>
              <Text style={styles.btnText}>В магазин</Text>
            </Pressable>
          </View>
        )}

        {/* ===== СТАТИСТИКА ===== */}
        <View style={styles.stats}>
          <StatTile value={hours(playtimeMs)} label="Наиграно" />
          <StatTile value={nf.format(gamesCount)} label="Игр" />
          <StatTile value={String(onlineFriends.length)} label="В сети" />
          <StatTile value={String(level)} label={isPro ? 'Уровень · PRO' : 'Уровень'} />
        </View>

        {/* ===== ПРОФИЛЬ-ПОЛОСА ===== */}
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            {user?.profile?.avatar_url ? (
              <Image source={{ uri: user.profile.avatar_url }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{displayName[0]?.toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.profileBody}>
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${levelPct}%` }]} />
            </View>
            <Text style={styles.progressText} numberOfLines={1}>
              До {level + 1} уровня · {nf.format(levelXp)}/{nf.format(levelGoal)} XP
            </Text>
          </View>
          <Pressable onPress={() => router.push('/profile' as Href)}>
            <Text style={styles.link}>Профиль</Text>
          </Pressable>
        </View>

        {/* ===== РЕКОМЕНДУЕМОЕ ===== */}
        {recs.length > 0 && (
          <View style={styles.section}>
            <SectionHead title="Рекомендуемое" count={`// ${recs.length}`} onAll={() => router.push('/store' as Href)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recRow}>
              {recs.slice(0, 8).map((g) => (
                <Pressable key={g.ID} style={styles.recCard} onPress={() => router.push(`/game/${g.ID}` as Href)}>
                  {g.header_image || g.banner_url ? (
                    <Image source={{ uri: g.header_image || g.banner_url }} style={styles.recImg} />
                  ) : (
                    <View style={[styles.recImg, styles.continueFallback]} />
                  )}
                  {g.age_rating ? <Text style={styles.recAge}>{g.age_rating}</Text> : null}
                  <Text style={styles.recTitle} numberOfLines={2}>{g.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ===== ДРУЗЬЯ В СЕТИ ===== */}
        <View style={styles.section}>
          <SectionHead
            title="Друзья в сети"
            count={`// ${onlineFriends.length}`}
            onAll={() => router.push('/friends' as Href)}
          />
          {onlineFriends.length === 0 ? (
            <Text style={styles.dim}>Никого нет в сети. Позовите друзей!</Text>
          ) : (
            <View style={styles.list}>
              {onlineFriends.slice(0, 5).map((f) => {
                const p = getPresence(f.friend_details?.id);
                return (
                  <Pressable key={f.id} style={styles.friendRow} onPress={() => void openChat(f)}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>
                        {(f.friend_details?.username || '?')[0]?.toUpperCase()}
                      </Text>
                      <View style={styles.dotOnline} />
                    </View>
                    <View style={styles.friendBody}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {f.friend_details?.profile?.display_name || f.friend_details?.username || 'Друг'}
                      </Text>
                      <Text style={[styles.friendSub, p?.playing ? styles.friendPlaying : null]} numberOfLines={1}>
                        {p?.playing ? `Играет в ${p.playing}` : 'В сети'}
                      </Text>
                    </View>
                    <PlayingCover presence={p} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ===== ЛЕНТА АКТИВНОСТИ ===== */}
        {activity.length > 0 && (
          <View style={styles.section}>
            <SectionHead title="Лента активности" />
            <View style={styles.list}>
              {activity.map((it) => (
                <View key={it.id} style={styles.actRow}>
                  <ActivityImage uri={it.target_image} />
                  <View style={styles.actBody}>
                    <Text style={styles.actTitle} numberOfLines={1}>
                      {ACTIVITY_VERB[it.kind]}{it.target_name ? ` ${it.target_name}` : ''}
                    </Text>
                    <Text style={styles.actWhen}>{relTime(it.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ===== НОВОСТИ ===== */}
        {news.length > 0 && (
          <View style={styles.section}>
            <SectionHead title="Новости" />
            <View style={styles.list}>
              {news.map((n) => (
                <View key={n.id} style={styles.newsRow}>
                  <Text style={styles.newsKicker}>
                    {(n.category || 'новость').toUpperCase()} · {fmtDate(n.created_at)}
                  </Text>
                  <Text style={styles.newsTitle}>{n.title}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.note}>Скачивание и запуск игр — в настольном лаунчере Lustre.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Битая ссылка не должна оставлять пустое место
function ActivityImage({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return <View style={[styles.actImg, styles.continueFallback]} />;
  return <Image source={{ uri }} style={styles.actImg} onError={() => setFailed(true)} />;
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function SectionHead({ title, count, onAll }: { title: string; count?: string; onAll?: () => void }) {
  return (
    <View style={styles.secHead}>
      <View style={styles.secBar} />
      <Text style={styles.secTitle}>{title}</Text>
      {count ? <Text style={styles.secCount}>{count}</Text> : null}
      <View style={styles.secLine} />
      {onAll ? (
        <Pressable onPress={onAll} hitSlop={8}>
          <Text style={styles.secAll}>ВСЁ →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  loader: { marginTop: 60 },
  content: { padding: 16, paddingBottom: 40, gap: 16 },

  greet: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    padding: 18,
  },
  kicker: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 2 },
  hello: { color: L.text, fontSize: 24, fontFamily: 'Tiny5', marginTop: 10, letterSpacing: 1 },
  helloAccent: { color: L.accent },
  greetSub: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginTop: 8 },
  online: { color: L.success, fontWeight: '800' },
  greetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { backgroundColor: 'rgba(255,0,110,0.16)', borderWidth: 1, borderColor: L.accent, borderRadius: 0, paddingHorizontal: 18, paddingVertical: 10 },
  btnText: { color: '#fff', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  btnGhost: { backgroundColor: 'transparent', borderColor: L.border },
  btnGhostText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  continue: { borderRadius: 0, borderWidth: 1, borderColor: L.border, overflow: 'hidden', backgroundColor: L.card },
  continueImg: { width: '100%', height: 170 },
  continueFallback: { backgroundColor: '#121017' },
  continueOverlay: { padding: 14, gap: 4 },
  continueKicker: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 2 },
  continueTitle: { color: L.text, fontSize: 20, fontFamily: 'Tiny5', letterSpacing: 0.5 },
  continueMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  continueMetaText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  chipAge: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', borderWidth: 1, borderColor: L.borderStrong, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 0 },
  chipOk: { color: L.success, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', borderWidth: 1, borderColor: 'rgba(52,211,153,0.5)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 0 },

  emptyCard: { backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 18, alignItems: 'flex-start', gap: 8 },
  emptyTitle: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },
  emptyText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },

  stats: { flexDirection: 'row', gap: 10 },
  statTile: { flex: 1, backgroundColor: L.card, borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingVertical: 14, alignItems: 'center' },
  statValue: { color: L.accent, fontSize: 18, fontFamily: 'Tiny5', },
  statLabel: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: L.card, borderWidth: 1, borderColor: L.border, borderRadius: 0, padding: 14 },
  avatar: { width: 48, height: 48, borderRadius: 0, borderWidth: 2, borderColor: L.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { color: L.text, fontSize: 20, fontFamily: 'Tiny5', },
  profileBody: { flex: 1, minWidth: 0, gap: 6 },
  profileName: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },
  progressTrack: { height: 6, borderRadius: 0, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: L.accent },
  progressText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  link: { color: L.accent, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  section: { gap: 12 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secBar: { width: 3, height: 16, backgroundColor: L.accent },
  secTitle: { color: L.text, fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 2 },
  secCount: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  secLine: { flex: 1, height: 1, backgroundColor: L.border },
  secAll: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 1 },

  recRow: { gap: 12, paddingRight: 6 },
  recCard: { width: 200, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, overflow: 'hidden' },
  recImg: { width: '100%', height: 108 },
  recAge: { position: 'absolute', top: 8, left: 8, color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 0, overflow: 'hidden' },
  recTitle: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', padding: 12 },

  list: { gap: 10 },
  dim: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },

  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 12 },
  friendAvatar: { width: 42, height: 42, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  friendAvatarText: { color: L.text, fontSize: 17, fontFamily: 'Tiny5', },
  dotOnline: { position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: 0, backgroundColor: L.success, borderWidth: 2, borderColor: L.card },
  friendBody: { flex: 1, minWidth: 0 },
  friendName: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  friendSub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  friendPlaying: { color: L.accent },

  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 12 },
  actImg: { width: 40, height: 40, borderRadius: 0, backgroundColor: L.cardAlt },
  actBody: { flex: 1, minWidth: 0, gap: 3 },
  actTitle: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  actWhen: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },

  newsRow: { backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 14, gap: 6 },
  newsKicker: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 1.5 },
  newsTitle: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', lineHeight: 18 },

  note: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginTop: 8 },
}));
