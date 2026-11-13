import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,

  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { ChevronDown, ChevronLeft, MessageSquare, Plus, Search, Users, X } from 'lucide-react-native';

import {
  createCommunityPost,
  getCommunities,
  getCommunityGames,
  getCommunityPosts,
  type Community,
  type CommunityGame,
  type CommunityPost,
} from '@/api/community';
import ComposerModal, { type ComposerValues } from '@/components/community/ComposerModal';
import { authorName, avatarUri, formatDate, initials } from '@/components/community/helpers';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

type SortKey = 'popular' | 'discussions' | 'alpha';

interface GameForum {
  game: CommunityGame;
  communities: Community[];
  communityCount: number;
  discussions: number;
  members: number;
}

type Row =
  | { type: 'forum'; key: string; forum: GameForum }
  | { type: 'result'; key: string; post: CommunityPost; community: Community };

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'popular', label: 'По популярности' },
  { id: 'discussions', label: 'По обсуждениям' },
  { id: 'alpha', label: 'По алфавиту' },
];

export default function DiscussionsScreen() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [games, setGames] = useState<CommunityGame[]>([]);
  const [postsByCommunity, setPostsByCommunity] = useState<Record<number, CommunityPost[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('popular');
  const [expandedGame, setExpandedGame] = useState<number | null>(null);
  const [showRegular, setShowRegular] = useState(false);
  const [showNsfw, setShowNsfw] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = useCallback(() => {
    Promise.all([getCommunities(), getCommunityGames()])
      .then(async ([comms, gs]) => {
        setCommunities(comms);
        setGames(gs);
        const entries = await Promise.all(
          comms.map(async (c) => {
            try {
              return [c.ID, await getCommunityPosts(c.ID)] as const;
            } catch {
              return [c.ID, [] as CommunityPost[]] as const;
            }
          }),
        );
        setPostsByCommunity(Object.fromEntries(entries));
      })
      .catch((e) => setError(apiError(e, 'Не удалось загрузить обсуждения')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allPosts = useMemo(() => {
    const result: { post: CommunityPost; community: Community }[] = [];
    for (const community of communities) {
      for (const post of postsByCommunity[community.ID] || []) {
        result.push({ post, community });
      }
    }
    return result;
  }, [communities, postsByCommunity]);

  const q = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!q) return [];
    return allPosts.filter(({ post, community }) =>
      post.title.toLowerCase().includes(q) ||
      (post.content || '').toLowerCase().includes(q) ||
      community.name.toLowerCase().includes(q) ||
      (community.game?.title || '').toLowerCase().includes(q),
    );
  }, [allPosts, q]);

  const filteredGames = useMemo(() => {
    if (!showRegular && !showNsfw) return games;
    return games.filter((g) => (showRegular && !g.is_adult) || (showNsfw && !!g.is_adult));
  }, [games, showRegular, showNsfw]);

  const sortedForums = useMemo<GameForum[]>(() => {
    const list = filteredGames.map((g) => {
      const comms = communities.filter((c) => c.game_id === g.ID);
      return {
        game: g,
        communities: comms,
        communityCount: comms.length,
        discussions: comms.reduce((s, c) => s + (postsByCommunity[c.ID]?.length || 0), 0),
        members: comms.reduce((s, c) => s + (c.members_count || 0), 0),
      };
    });
    switch (sort) {
      case 'popular':
        return list.sort((a, b) => b.members - a.members);
      case 'discussions':
        return list.sort((a, b) => b.discussions - a.discussions);
      case 'alpha':
        return list.sort((a, b) => a.game.title.localeCompare(b.game.title, 'ru'));
      default:
        return list;
    }
  }, [filteredGames, communities, postsByCommunity, sort]);

  const rows: Row[] = q
    ? searchResults.map(({ post, community }) => ({
        type: 'result',
        key: `r${post.ID}`,
        post,
        community,
      }))
    : sortedForums.map((forum) => ({ type: 'forum', key: `f${forum.game.ID}`, forum }));

  const openCommunity = (id: number) =>
    router.push(`/community/${id}?tab=discussions` as Href);

  const retry = () => {
    setLoading(true);
    setError('');
    load();
  };

  const submitComposer = async (values: ComposerValues) => {
    setSubmitError('');
    if (!values.communityId) {
      setSubmitError('Выберите сообщество');
      return;
    }
    if (!values.title) {
      setSubmitError('Введите заголовок обсуждения');
      return;
    }
    setSubmitting(true);
    try {
      await createCommunityPost(values.communityId, {
        title: values.title,
        content: values.content,
      });
      setComposerOpen(false);
      setLoading(true);
      load();
    } catch (e) {
      setSubmitError(apiError(e, 'Не удалось создать обсуждение'));
    } finally {
      setSubmitting(false);
    }
  };

  const listHeader = (
    <View>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
        <ChevronLeft size={16} color={L.accent} />
        <Text style={styles.backText}>Назад</Text>
      </Pressable>

      <Text style={styles.title}>
        Обсуждения <Text style={styles.accent}>Lustre</Text>
      </Text>
      <Text style={styles.subtitle}>Форумы платформы и игровые сообщества</Text>

      <View style={styles.searchRow}>
        <Search size={16} color={L.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по обсуждениям..."
          placeholderTextColor={L.muted}
          style={styles.search}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X size={14} color={L.muted} />
          </Pressable>
        ) : null}
      </View>

      {q ? (
        <View style={styles.sectionHead}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>Результаты поиска</Text>
          <Text style={styles.sectionCount}>{`// ${searchResults.length}`}</Text>
          <View style={styles.sectionLine} />
        </View>
      ) : (
        <>
          <View style={styles.sectionHead}>
            <View style={styles.sectionBar} />
            <Text style={styles.sectionTitle}>
              Обзор <Text style={styles.accent}>форумов</Text>
            </Text>
            <View style={styles.sectionLine} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SORTS.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSort(s.id)}
                style={[styles.chip, sort === s.id && styles.chipOn]}>
                <Text style={[styles.chipText, sort === s.id && styles.chipTextOn]}>{s.label}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowRegular((v) => !v)}
              style={[styles.chip, showRegular && styles.chipRegular]}>
              <View style={[styles.dot, showRegular ? styles.dotCyan : styles.dotMuted]} />
              <Text style={[styles.chipText, showRegular && styles.chipTextOn]}>Обычные игры</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowNsfw((v) => !v)}
              style={[styles.chip, showNsfw && styles.chipNsfw]}>
              <View style={[styles.dot, showNsfw ? styles.dotPink : styles.dotMuted]} />
              <Text style={[styles.chipText, showNsfw && styles.chipTextOn]}>NSFW игры</Text>
            </Pressable>
            {showRegular || showNsfw ? (
              <Pressable
                onPress={() => {
                  setShowRegular(false);
                  setShowNsfw(false);
                }}
                style={styles.chip}>
                <X size={12} color={L.muted} />
                <Text style={styles.chipText}>Сброс</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <Pressable
            onPress={() => {
              setSubmitError('');
              setComposerOpen(true);
            }}
            style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}>
            <Plus size={15} color="#fff" />
            <Text style={styles.createText}>Создать обсуждение</Text>
          </Pressable>
        </>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: Row }) => {
    if (item.type === 'result') {
      const { post, community } = item;
      const name = authorName(post.author);
      const avatar = avatarUri(post.author);
      return (
        <Pressable
          onPress={() => openCommunity(community.ID)}
          style={({ pressed }) => [styles.resultCard, pressed && styles.pressed]}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials(name)}</Text>
            </View>
          )}
          <View style={styles.flex}>
            <View style={styles.resultChips}>
              <Text style={[styles.miniChip, styles.miniChipViolet]} numberOfLines={1}>
                {community.name}
              </Text>
              {community.game?.title ? (
                <Text style={[styles.miniChip, styles.miniChipAccent]} numberOfLines={1}>
                  {community.game.title}
                </Text>
              ) : null}
            </View>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {post.title}
            </Text>
            {post.content ? (
              <Text style={styles.resultContent} numberOfLines={1}>
                {post.content}
              </Text>
            ) : null}
            <Text style={styles.resultMeta}>
              {name} · {formatDate(post.CreatedAt)}
            </Text>
          </View>
          <MessageSquare size={16} color={L.muted} />
        </Pressable>
      );
    }

    const { forum } = item;
    const expanded = expandedGame === forum.game.ID;
    return (
      <View style={styles.forumCard}>
        <Pressable
          onPress={() => setExpandedGame(expanded ? null : forum.game.ID)}
          style={({ pressed }) => [styles.forumHead, pressed && styles.pressed]}>
          {forum.game.header_image ? (
            <Image source={{ uri: forum.game.header_image }} style={styles.forumImg} />
          ) : (
            <View style={[styles.forumImg, styles.forumImgFallback]} />
          )}
          <View style={styles.flex}>
            <Text style={styles.forumTitle} numberOfLines={2}>
              {forum.game.title}
            </Text>
            <View style={styles.forumMetaRow}>
              <View style={styles.metaItem}>
                <Users size={11} color={L.muted} />
                <Text style={styles.forumMeta}>{forum.communityCount} сообществ</Text>
              </View>
              <View style={styles.metaItem}>
                <MessageSquare size={11} color={L.muted} />
                <Text style={styles.forumMeta}>{forum.discussions} обсуждений</Text>
              </View>
              <View style={styles.metaItem}>
                <Users size={11} color={L.muted} />
                <Text style={styles.forumMeta}>{forum.members} участников</Text>
              </View>
            </View>
          </View>
          <ChevronDown
            size={16}
            color={L.muted}
            style={expanded ? styles.chevronOn : styles.chevron}
          />
        </Pressable>

        {expanded ? (
          <View style={styles.forumBody}>
            {forum.communities.length === 0 ? (
              <Text style={styles.dim}>Пока нет сообществ по этой игре</Text>
            ) : (
              forum.communities.map((c) => (
                <Pressable
                  key={c.ID}
                  onPress={() => openCommunity(c.ID)}
                  style={({ pressed }) => [styles.communityRow, pressed && styles.pressed]}>
                  <View style={[styles.rowIcon, styles.avatarFallback]}>
                    <MessageSquare size={14} color={L.accent} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.communityName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.communityTheme} numberOfLines={1}>
                      {c.theme?.name || ''}
                    </Text>
                  </View>
                  <Text style={styles.communityCount}>{postsByCommunity[c.ID]?.length || 0}</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const emptyText = q
    ? 'Ничего не найдено. Ищем по заголовкам, тексту и сообществам'
    : 'Игр в выбранных категориях нет. Снимите фильтр «Обычные» или «NSFW»';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <DataState
            loading={loading}
            error={error}
            empty={!loading && !error}
            emptyText={emptyText}
            onRetry={retry}
          />
        }
        renderItem={renderItem}
      />

      <ComposerModal
        key={composerOpen ? 'composer' : 'closed'}
        visible={composerOpen}
        heading="Новое обсуждение"
        subheading="Форумы платформы и игровые сообщества"
        communities={communities}
        allowImage={false}
        submitting={submitting}
        error={submitError}
        submitLabel="Опубликовать"
        onClose={() => setComposerOpen(false)}
        onSubmit={(v) => void submitComposer(v)}
      />
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },
  list: { padding: 16, gap: 12, paddingBottom: 40 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, alignSelf: 'flex-start' },
  backText: {
    color: L.accent,
    fontSize: 13, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { color: L.text, fontSize: 24, fontFamily: 'Tiny5', letterSpacing: 0.5 },
  accent: { color: L.accent },
  subtitle: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 6,
    marginBottom: 14,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  search: { flex: 1, color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', paddingVertical: 11 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  sectionBar: { width: 4, height: 14, borderRadius: 0, backgroundColor: L.accent },
  sectionTitle: { color: L.text, fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },
  sectionCount: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  sectionLine: { flex: 1, height: 1, backgroundColor: L.border },

  chipRow: { gap: 8, paddingVertical: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: L.card,
  },
  chipOn: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.16)' },
  chipRegular: { borderColor: 'rgba(34,211,238,0.5)' },
  chipNsfw: { borderColor: 'rgba(255,91,138,0.5)' },
  chipText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  chipTextOn: { color: '#fff' },
  dot: { width: 6, height: 6, borderRadius: 0 },
  dotCyan: { backgroundColor: '#22d3ee' },
  dotPink: { backgroundColor: '#ff5b8a' },
  dotMuted: { backgroundColor: L.muted },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: L.accent,
    borderRadius: 0,
    paddingVertical: 13,
    marginTop: 12,
  },
  createText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },

  avatar: { width: 36, height: 36, borderRadius: 0 },
  avatarFallback: { backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', },

  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 12,
  },
  resultChips: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  miniChip: {
    maxWidth: 130,
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    color: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 0,
    overflow: 'hidden',
  },
  miniChipViolet: { backgroundColor: 'rgba(131,56,236,0.85)' },
  miniChipAccent: { backgroundColor: 'rgba(255,0,110,0.85)' },
  resultTitle: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  resultContent: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  resultMeta: { color: 'rgba(244,244,246,0.6)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },

  forumCard: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    overflow: 'hidden',
  },
  forumHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  forumImg: { width: 96, height: 60, borderRadius: 0, backgroundColor: '#121017' },
  forumImgFallback: { backgroundColor: 'rgba(131,56,236,0.3)' },
  forumTitle: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', textTransform: 'uppercase' },
  forumMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  forumMeta: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', },
  chevron: { transform: [{ rotate: '0deg' }] },
  chevronOn: { transform: [{ rotate: '180deg' }] },
  forumBody: {
    borderTopWidth: 1,
    borderTopColor: L.border,
    padding: 10,
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dim: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', paddingVertical: 6 },

  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 0 },
  rowIcon: { width: 32, height: 32, borderRadius: 0 },
  communityName: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  communityTheme: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  communityCount: { color: L.accent, fontSize: 14, fontFamily: 'Tiny5', },
}));
