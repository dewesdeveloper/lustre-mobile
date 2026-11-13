import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,

  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { ChevronLeft, Image as ImageIcon, MessageSquare, Plus, Search, Wrench, X } from 'lucide-react-native';

import {
  deleteCommunity,
  getCommunities,
  getCommunityInvite,
  getCommunityStats,
  type Community,
  type CommunityStats,
} from '@/api/community';
import CommunityCard from '@/components/community/CommunityCard';
import InviteModal from '@/components/community/InviteModal';
import DataState from '@/components/ui/DataState';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';
import { canModerate } from '@/utils/roles';

type TabKey = 'mine' | 'all';
type SortKey = 'popular' | 'alpha' | 'new';

const PAGE_SIZE = 12;

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'popular', label: 'По популярности' },
  { id: 'alpha', label: 'По алфавиту' },
  { id: 'new', label: 'Сначала новые' },
];

export default function CommunityListScreen() {
  const { user } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [sort, setSort] = useState<SortKey>('popular');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [invite, setInvite] = useState<{ name: string; code: string } | null>(null);

  const load = useCallback(() => {
    setError('');
    setLoading(true);
    Promise.all([getCommunities(), getCommunityStats().catch(() => null)])
      .then(([list, s]) => {
        setCommunities(list);
        if (s) setStats(s);
      })
      .catch((e) => setError(apiError(e, 'Не удалось загрузить сообщества')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const resetPage = () => setVisibleCount(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source =
      tab === 'mine'
        ? communities.filter((c) => c.creator_id === user?.id || c.is_private)
        : communities;
    const searched = q
      ? source.filter((c) =>
          `${c.name} ${c.description || ''} ${c.game?.title || ''} ${c.theme?.name || ''}`
            .toLowerCase()
            .includes(q),
        )
      : source;

    return [...searched].sort((a, b) => {
      if (sort === 'alpha') return a.name.localeCompare(b.name, 'ru');
      if (sort === 'new') {
        const av = a.CreatedAt ? new Date(a.CreatedAt).getTime() : a.ID;
        const bv = b.CreatedAt ? new Date(b.CreatedAt).getTime() : b.ID;
        return bv - av;
      }
      return (b.members_count || 0) - (a.members_count || 0);
    });
  }, [communities, tab, query, sort, user?.id]);

  const page = filtered.slice(0, visibleCount);
  const canGoBack = router.canGoBack();

  const confirmDelete = (community: Community) => {
    Alert.alert('Удалить это сообщество?', community.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deleteCommunity(community.ID)
            .then(() => setCommunities((prev) => prev.filter((c) => c.ID !== community.ID)))
            .catch((e) => Alert.alert('Ошибка', apiError(e, 'Не удалось удалить сообщество')));
        },
      },
    ]);
  };

  const openInvite = async (community: Community) => {
    try {
      const code = await getCommunityInvite(community.ID);
      setInvite({ name: community.name, code });
    } catch (e) {
      Alert.alert('Ошибка', apiError(e, 'Не удалось получить ссылку-приглашение'));
    }
  };

  const listHeader = (
    <View>
      {canGoBack ? (
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <ChevronLeft size={16} color={L.accent} />
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      ) : null}

      <Text style={styles.title}>
        Сообщество <Text style={styles.accent}>Lustre</Text>
      </Text>
      <Text style={styles.subtitle}>Центр управления контентом и связью с игроками</Text>

      <View style={styles.searchRow}>
        <Search size={16} color={L.muted} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            resetPage();
          }}
          placeholder="Поиск сообществ..."
          placeholderTextColor={L.muted}
          style={styles.search}
        />
        {query ? (
          <Pressable
            onPress={() => {
              setQuery('');
              resetPage();
            }}
            hitSlop={8}
            style={styles.clear}>
            <X size={14} color={L.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'mine' as TabKey, label: 'Мои' },
            { id: 'all' as TabKey, label: 'Все' },
          ]
        ).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              setTab(t.id);
              resetPage();
            }}
            style={[styles.tab, tab === t.id && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        {SORTS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => {
              setSort(s.id);
              resetPage();
            }}
            style={[styles.chip, sort === s.id && styles.chipOn]}>
            <Text style={[styles.chipText, sort === s.id && styles.chipTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/community/create' as Href)}
          style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}>
          <Plus size={16} color="#fff" />
          <Text style={styles.createText}>Создать сообщество</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/community/discussions' as Href)}
          style={({ pressed }) => [styles.forumBtn, pressed && styles.pressed]}>
          <MessageSquare size={16} color={L.text} />
          <Text style={styles.forumText}>Обсуждения</Text>
        </Pressable>
      </View>

      {/* Общие ленты всех сообществ — как вкладки «Скриншоты» и «Мастерская» в лаунчере */}
      <View style={[styles.actions, styles.feedsRow]}>
        <Pressable
          onPress={() => router.push('/community/feeds?kind=screenshots' as Href)}
          style={({ pressed }) => [styles.forumBtn, styles.feedBtn, pressed && styles.pressed]}>
          <ImageIcon size={16} color={L.text} />
          <Text style={styles.forumText}>Скриншоты</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/community/feeds?kind=workshop' as Href)}
          style={({ pressed }) => [styles.forumBtn, styles.feedBtn, pressed && styles.pressed]}>
          <Wrench size={16} color={L.text} />
          <Text style={styles.forumText}>Мастерская</Text>
        </Pressable>
      </View>

      {stats ? (
        <View style={styles.stats}>
          <Text style={styles.statsHead}>
            Активность Lustre <Text style={styles.live}>· Live</Text>
          </Text>
          <View style={styles.statsGrid}>
            <Stat label="Игроков онлайн" value={stats.online_users} color="#22d3ee" />
            <Stat label="Обсуждений" value={stats.discussions} color={L.accent} />
            <Stat label="Участников" value={stats.members} color={L.violet} />
            <Stat label="Сообществ" value={stats.communities} color="#f59e0b" />
          </View>
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>Сообщества</Text>
        <Text style={styles.sectionCount}>{`// ${filtered.length}`}</Text>
        <View style={styles.sectionLine} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={page}
        keyExtractor={(item) => String(item.ID)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <DataState
            loading={loading}
            error={error}
            empty={!loading && !error}
            emptyText={
              query
                ? 'Ничего не найдено по запросу'
                : tab === 'mine'
                  ? 'У вас пока нет сообществ — создайте первое'
                  : 'Пока нет ни одного сообщества. Стань первым — создай сообщество по любимой игре'
            }
            onRetry={load}
          />
        }
        ListFooterComponent={
          filtered.length > visibleCount ? (
            <Pressable
              onPress={() => setVisibleCount((v) => v + PAGE_SIZE)}
              style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
              <Text style={styles.moreText}>
                Показать ещё ({filtered.length - visibleCount})
              </Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item }) => (
          <CommunityCard
            community={item}
            canManage={item.creator_id === user?.id}
            canDelete={item.creator_id === user?.id || canModerate(user?.role)}
            onOpen={() => router.push(`/community/${item.ID}` as Href)}
            onInvite={() => void openInvite(item)}
            onDelete={() => confirmDelete(item)}
          />
        )}
      />

      {invite ? (
        <InviteModal
          visible
          name={invite.name}
          code={invite.code}
          onClose={() => setInvite(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value?: number; color: string }) {
  const text =
    value === undefined || value === null ? '—' : new Intl.NumberFormat('ru-RU').format(value);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{text}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  list: { padding: 16, paddingTop: 8, gap: 12, paddingBottom: 40 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, alignSelf: 'flex-start' },
  backText: { color: L.accent, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  title: { color: L.text, fontSize: 26, fontFamily: 'Tiny5', letterSpacing: 0.5 },
  accent: { color: L.accent },
  subtitle: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 6,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  searchIcon: { marginRight: 8 },
  search: { flex: 1, color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', paddingVertical: 11 },
  clear: { padding: 4 },

  tabs: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: L.card,
  },
  tabOn: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.14)' },
  tabText: { color: L.muted, fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  tabTextOn: { color: '#fff' },

  sortRow: { gap: 8, paddingVertical: 12 },
  chip: {
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: L.card,
  },
  chipOn: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.16)' },
  chipText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  chipTextOn: { color: '#fff' },

  actions: { flexDirection: 'row', gap: 8 },
  createBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: L.accent,
    borderRadius: 0,
    paddingVertical: 14,
  },
  createText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },
  forumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: L.card,
  },
  forumText: { color: L.text, fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },
  pressed: { opacity: 0.8 },
  feedsRow: { marginTop: 8 },
  feedBtn: { flex: 1 },

  stats: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 14,
    marginTop: 16,
  },
  statsHead: { color: L.text, fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },
  live: { color: L.success, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: L.cardAlt,
    borderRadius: 0,
    padding: 10,
  },
  statValue: { fontSize: 18, fontFamily: 'Tiny5', },
  statLabel: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 4 },
  sectionBar: { width: 4, height: 14, borderRadius: 0, backgroundColor: L.accent },
  sectionTitle: { color: L.text, fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },
  sectionCount: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  sectionLine: { flex: 1, height: 1, backgroundColor: L.border },

  more: {
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  moreText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
}));
