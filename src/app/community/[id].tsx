import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,

  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Camera, ChevronLeft, Link2, Lock, Plus, Users } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import {
  addCommunityImage,
  createCommunityPost,
  deleteCommunityImage,
  deleteCommunityPost,
  getCommunity,
  getCommunityImages,
  getCommunityInvite,
  getCommunityPosts,
  uploadCommunityImage,
  type Community,
  type CommunityImage,
  type CommunityPost,
} from '@/api/community';
import ComposerModal, { type ComposerValues } from '@/components/community/ComposerModal';
import InviteModal from '@/components/community/InviteModal';
import { ImageCard, PostCard } from '@/components/community/PostCard';
import { authorName, avatarUri, formatDate, initials } from '@/components/community/helpers';
import DataState from '@/components/ui/DataState';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';
import { canModerate } from '@/utils/roles';
import VoiceChannelsSection from '@/components/voice/VoiceChannelsSection';

type TabKey = 'posts' | 'discussions' | 'about' | 'voice';
type ComposerMode = 'publish' | 'discussion';

type FeedItem = {
  key: string;
  kind: 'post' | 'image';
  at: number;
  post?: CommunityPost;
  image?: CommunityImage;
};

export default function CommunityDetailScreen() {
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const communityId = Number(params.id);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const invalidId = !communityId;
  const [community, setCommunity] = useState<Community | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [images, setImages] = useState<CommunityImage[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>(
    params.tab === 'discussions' ? 'discussions' : params.tab === 'voice' ? 'voice' : 'posts',
  );
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [invite, setInvite] = useState<{ name: string; code: string } | null>(null);

  useEffect(() => {
    if (!communityId) return;
    let alive = true;
    Promise.all([
      getCommunity(communityId),
      getCommunityImages(communityId),
      getCommunityPosts(communityId),
    ])
      .then(([details, imgs, list]) => {
        if (!alive) return;
        setCommunity(details.community);
        setIsMember(details.is_member);
        setImages(imgs);
        setPosts(list);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [communityId]);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...posts.map((p) => ({
        key: `p${p.ID}`,
        kind: 'post' as const,
        at: p.CreatedAt ? new Date(p.CreatedAt).getTime() : p.ID,
        post: p,
      })),
      ...images.map((img) => ({
        key: `i${img.ID}`,
        kind: 'image' as const,
        at: img.CreatedAt ? new Date(img.CreatedAt).getTime() : img.ID,
        image: img,
      })),
    ];
    return items.sort((a, b) => b.at - a.at);
  }, [posts, images]);

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
        <ChevronLeft size={16} color={L.accent} />
        <Text style={styles.backText}>Назад</Text>
      </Pressable>
      <Text style={styles.topTitle} numberOfLines={1}>
        {community?.name || 'Сообщество'}
      </Text>
    </View>
  );

  if (!invalidId && loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {topBar}
        <View style={styles.center}>
          <ActivityIndicator color={L.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (invalidId || !community) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {topBar}
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Сообщество недоступно</Text>
          <Text style={styles.errorText}>
            Оно не существует или это приватное сообщество, куда у вас нет приглашения
          </Text>
          <Pressable
            onPress={() => router.replace('/community' as Href)}
            style={({ pressed }) => [styles.errorBtn, pressed && styles.pressed]}>
            <Text style={styles.errorBtnText}>Вернуться в сообщества</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = user?.id === community.creator_id;
  const canPost = isOwner || isMember || !community.is_private;
  // модератор (moderator/manager/admin) удаляет любой контент сообщества
  const isModerator = canModerate(user?.role);
  const canDeletePost = (post: CommunityPost) => isOwner || isModerator || user?.id === post.author_id;
  const canDeleteImage = (img: CommunityImage) => isOwner || isModerator || user?.id === img.author_id;
  const cover =
    community.cover_url || community.game?.header_image || community.game?.banner_url || '';
  const ownerName = authorName(community.creator);
  const ownerAvatar = avatarUri(community.creator);

  const openInvite = async () => {
    try {
      const code = await getCommunityInvite(community.ID);
      setInvite({ name: community.name, code });
    } catch (e) {
      Alert.alert('Ошибка', apiError(e, 'Не удалось получить ссылку-приглашение'));
    }
  };

  const confirmDeletePost = (post: CommunityPost) => {
    Alert.alert('Удалить это обсуждение?', post.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deleteCommunityPost(post.ID)
            .then(() => setPosts((prev) => prev.filter((p) => p.ID !== post.ID)))
            .catch((e) => Alert.alert('Ошибка', apiError(e, 'Не удалось удалить обсуждение')));
        },
      },
    ]);
  };

  const confirmDeleteImage = (img: CommunityImage) => {
    Alert.alert('Удалить это изображение?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deleteCommunityImage(img.ID)
            .then(() => setImages((prev) => prev.filter((i) => i.ID !== img.ID)))
            .catch((e) => Alert.alert('Ошибка', apiError(e, 'Не удалось удалить изображение')));
        },
      },
    ]);
  };

  const addImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      const ext = (a.uri.split('.').pop() || 'jpg').split('?')[0];
      const url = await uploadCommunityImage({
        uri: a.uri,
        name: a.fileName || `community_${Date.now()}.${ext}`,
        mimeType: a.mimeType || 'image/jpeg',
      });
      const created = await addCommunityImage(community.ID, url);
      setImages((prev) => [created, ...prev]);
    } catch (e) {
      Alert.alert('Ошибка', apiError(e, 'Не удалось добавить изображение'));
    }
  };

  const submitComposer = async (values: ComposerValues) => {
    setSubmitError('');
    const hasTitle = !!values.title;
    const hasImage = !!values.image;
    if (!hasTitle && !hasImage) {
      setSubmitError('Введите заголовок или добавьте изображение');
      return;
    }
    setSubmitting(true);
    try {
      if (hasTitle) {
        const post = await createCommunityPost(community.ID, {
          title: values.title,
          content: values.content,
        });
        setPosts((prev) => [post, ...prev]);
      }
      if (hasImage && values.image) {
        const url = await uploadCommunityImage(values.image);
        const created = await addCommunityImage(community.ID, url);
        setImages((prev) => [created, ...prev]);
      }
      setComposerMode(null);
    } catch (e) {
      setSubmitError(apiError(e, 'Не удалось опубликовать контент'));
    } finally {
      setSubmitting(false);
    }
  };

  const composer = (
    <ComposerModal
      key={composerMode || 'closed'}
      visible={composerMode !== null}
      heading={composerMode === 'discussion' ? 'Новое обсуждение' : 'Опубликовать контент'}
      subheading={
        composerMode === 'discussion'
          ? 'Тема для обсуждения в вашем сообществе'
          : 'Изображение или обсуждение в вашем сообществе'
      }
      allowImage={composerMode === 'publish'}
      submitting={submitting}
      error={submitError}
      onClose={() => setComposerMode(null)}
      onSubmit={(v) => void submitComposer(v)}
    />
  );

  const inviteModal = invite ? (
    <InviteModal visible name={invite.name} code={invite.code} onClose={() => setInvite(null)} />
  ) : null;

  const hero = (
    <View>
      <View style={styles.hero}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.heroCover} />
        ) : (
          <View style={[styles.heroCover, styles.heroFallback]} />
        )}
        <View style={styles.heroOverlay} />
        <View style={styles.heroBody}>
          <View style={styles.chips}>
            {community.game?.title ? (
              <Text style={[styles.chip, styles.chipViolet]}>{community.game.title}</Text>
            ) : null}
            {community.theme?.name ? (
              <Text style={[styles.chip, styles.chipAccent]}>{community.theme.name}</Text>
            ) : null}
            {community.is_private ? (
              <View style={[styles.chip, styles.chipRow]}>
                <Lock size={10} color={L.violet} />
                <Text style={styles.chipPrivateText}>Приватное</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroTitle}>{community.name}</Text>
        </View>
      </View>

      <View style={styles.ownerRow}>
        {ownerAvatar ? (
          <Image source={{ uri: ownerAvatar }} style={styles.ownerAvatar} />
        ) : (
          <View style={[styles.ownerAvatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>{initials(ownerName)}</Text>
          </View>
        )}
        <View style={styles.flex}>
          <Text style={styles.ownerLabel}>Владелец</Text>
          <Text style={styles.ownerName} numberOfLines={1}>
            {ownerName}
          </Text>
        </View>
        {isOwner ? (
          <Text style={styles.badge}>Владелец</Text>
        ) : isMember ? (
          <Text style={[styles.badge, styles.badgeMember]}>Вы участник</Text>
        ) : null}
        <View style={styles.members}>
          <Users size={15} color={L.muted} />
          <Text style={styles.membersValue}>{community.members_count}</Text>
        </View>
      </View>

      {isOwner && community.is_private ? (
        <Pressable
          onPress={() => void openInvite()}
          style={({ pressed }) => [styles.inviteBtn, pressed && styles.pressed]}>
          <Link2 size={14} color={L.accent} />
          <Text style={styles.inviteText}>Ссылка-приглашение</Text>
        </Pressable>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{community.members_count}</Text>
          <Text style={styles.statLabel}>Участников</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, styles.statAccent]}>{posts.length}</Text>
          <Text style={styles.statLabel}>Обсуждений</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={[styles.statValue, styles.statViolet]}>{images.length}</Text>
          <Text style={styles.statLabel}>Изображений</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'posts' as TabKey, label: 'Посты', count: feed.length },
            { id: 'discussions' as TabKey, label: 'Обсуждения', count: posts.length },
            { id: 'voice' as TabKey, label: 'Голос', count: 0 },
            { id: 'about' as TabKey, label: 'О чём', count: 0 },
          ]
        ).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setActiveTab(t.id)}
            style={[styles.tab, activeTab === t.id && styles.tabOn]}>
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextOn]}>
              {t.label}
              {t.count ? <Text style={styles.tabCount}> ({t.count})</Text> : null}
            </Text>
          </Pressable>
        ))}
      </View>

      {canPost && activeTab === 'posts' ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              setSubmitError('');
              setComposerMode('publish');
            }}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Plus size={15} color="#fff" />
            <Text style={styles.primaryText}>Опубликовать</Text>
          </Pressable>
          <Pressable
            onPress={() => void addImage()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
            <Camera size={16} color={L.text} />
          </Pressable>
        </View>
      ) : null}

      {canPost && activeTab === 'discussions' ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              setSubmitError('');
              setComposerMode('discussion');
            }}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
            <Plus size={15} color="#fff" />
            <Text style={styles.primaryText}>Создать обсуждение</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const emptyText = !canPost
    ? 'Участники ещё ничего не опубликовали'
    : activeTab === 'discussions'
      ? 'Создайте первое обсуждение'
      : 'В ленте пока нет публикаций — опубликуйте первый пост';

  const data: FeedItem[] =
    activeTab === 'posts'
      ? feed
      : posts.map((p) => ({
          key: `p${p.ID}`,
          kind: 'post' as const,
          at: p.CreatedAt ? new Date(p.CreatedAt).getTime() : p.ID,
          post: p,
        }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {topBar}

      {activeTab === 'voice' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {hero}
          <VoiceChannelsSection communityId={community.ID} communityName={community.name} />
        </ScrollView>
      ) : activeTab === 'about' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {hero}
          <View style={styles.about}>
            <Text style={styles.aboutHead}>О чём сообщество</Text>
            <Text style={styles.aboutText}>
              {community.description || 'Описание пока не заполнено.'}
            </Text>
            <InfoRow label="Категория (игра)" value={community.game?.title || '—'} />
            <InfoRow label="Тематика" value={community.theme?.name || '—'} />
            <InfoRow label="Вид сообщества" value={community.is_private ? 'Приватное' : 'Публичное'} />
            <InfoRow label="Владелец" value={ownerName} />
            <InfoRow label="Создано" value={formatDate(community.CreatedAt) || '—'} />
            <InfoRow label="Участников" value={String(community.members_count)} />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          ListHeaderComponent={hero}
          ListEmptyComponent={<DataState empty emptyText={emptyText} />}
          renderItem={({ item }) => {
            if (item.kind === 'post' && item.post) {
              const post = item.post;
              return (
                <PostCard
                  post={post}
                  canDelete={canDeletePost(post)}
                  onDelete={() => confirmDeletePost(post)}
                  onPress={() => router.push(`/community/post/${post.ID}` as Href)}
                />
              );
            }
            if (item.image) {
              const image = item.image;
              return (
                <ImageCard
                  image={image}
                  canDelete={canDeleteImage(image)}
                  onDelete={() => confirmDeleteImage(image)}
                />
              );
            }
            return null;
          }}
        />
      )}

      {composer}
      {inviteModal}
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errorTitle: { color: L.text, fontSize: 18, fontFamily: 'Tiny5', textAlign: 'center' },
  errorText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, textAlign: 'center' },
  errorBtn: {
    borderWidth: 1,
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  errorBtnText: {
    color: L.text,
    fontSize: 12, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pressed: { opacity: 0.8 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: L.border,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: {
    color: L.accent,
    fontSize: 13, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topTitle: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', flex: 1, textAlign: 'right' },

  list: { padding: 16, gap: 12, paddingBottom: 40 },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  hero: {
    height: 170,
    borderRadius: 0,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#121017',
    marginBottom: 12,
  },
  heroCover: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroFallback: { backgroundColor: 'rgba(131,56,236,0.25)' },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,3,9,0.55)',
  },
  heroBody: { padding: 14, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
    overflow: 'hidden',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.65)' },
  chipViolet: { backgroundColor: 'rgba(131,56,236,0.85)' },
  chipAccent: { backgroundColor: 'rgba(255,0,110,0.85)' },
  chipPrivateText: { color: L.violet, fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 24, fontFamily: 'Tiny5', letterSpacing: 0.5 },

  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 12,
  },
  flex: { flex: 1, minWidth: 0 },
  ownerAvatar: { width: 32, height: 32, borderRadius: 0 },
  avatarFallback: { backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: L.text, fontSize: 13, fontFamily: 'Tiny5', },
  ownerLabel: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  ownerName: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', marginTop: 2 },
  badge: {
    color: L.accent,
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderColor: 'rgba(255,0,110,0.4)',
    backgroundColor: 'rgba(255,0,110,0.12)',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  badgeMember: {
    color: L.success,
    borderColor: 'rgba(52,211,153,0.4)',
    backgroundColor: 'rgba(52,211,153,0.12)',
  },
  members: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  membersValue: { color: L.accent, fontSize: 14, fontFamily: 'Tiny5', },

  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingVertical: 12,
    backgroundColor: 'rgba(131,56,236,0.1)',
    marginTop: 10,
  },
  inviteText: {
    color: L.accent,
    fontSize: 12, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statCell: {
    flex: 1,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { color: '#22d3ee', fontSize: 17, fontFamily: 'Tiny5', },
  statAccent: { color: L.accent },
  statViolet: { color: L.violet },
  statLabel: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },

  tabs: { flexDirection: 'row', gap: 6, marginTop: 14 },
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
  tabText: { color: L.muted, fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabTextOn: { color: '#fff' },
  tabCount: { fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', opacity: 0.7 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: L.accent,
    borderRadius: 0,
    paddingVertical: 13,
  },
  primaryText: {
    color: '#fff',
    fontSize: 12, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconBtn: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    backgroundColor: L.card,
  },

  about: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 16,
    gap: 10,
  },
  aboutHead: {
    color: L.text,
    fontSize: 12, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  aboutText: { color: 'rgba(244,244,246,0.6)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: L.border,
  },
  infoLabel: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  infoValue: { color: 'rgba(244,244,246,0.75)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', fontWeight: '600', flex: 2, textAlign: 'right' },
}));
