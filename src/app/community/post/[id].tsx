import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,

  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronLeft, Send, Trash } from 'lucide-react-native';

import {
  addPostComment,
  deletePostComment,
  deleteCommunityPost,
  getCommunityPost,
  getPostComments,
  type Community,
  type CommunityPost,
  type CommunityPostComment,
} from '@/api/community';
import { PostCard } from '@/components/community/PostCard';
import { authorName, avatarUri, formatDateTime, initials, isPro } from '@/components/community/helpers';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';
import { canModerate } from '@/utils/roles';

export default function CommunityPostScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const postId = Number(params.id);
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const invalidId = !postId;
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [comments, setComments] = useState<CommunityPostComment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    if (!postId) return;
    let alive = true;
    Promise.all([getCommunityPost(postId), getPostComments(postId)])
      .then(([details, list]) => {
        if (!alive) return;
        setPost(details.post);
        setCommunity(details.community);
        setComments(list);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [postId]);

  const isCommunityOwner = !!community && user?.id === community.creator_id;

  const send = async () => {
    const value = draft.trim();
    if (!value || sending) return;
    setSending(true);
    setSendError('');
    try {
      const created = await addPostComment(postId, value);
      setComments((prev) => [...prev, created]);
      setDraft('');
    } catch (e) {
      setSendError(apiError(e, 'Не удалось отправить сообщение'));
    } finally {
      setSending(false);
    }
  };

  const confirmDeleteComment = (comment: CommunityPostComment) => {
    Alert.alert('Удалить это сообщение?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deletePostComment(comment.ID)
            .then(() => setComments((prev) => prev.filter((c) => c.ID !== comment.ID)))
            .catch((e) => Alert.alert('Ошибка', apiError(e, 'Не удалось удалить сообщение')));
        },
      },
    ]);
  };

  const confirmDeletePost = () => {
    if (!post) return;
    Alert.alert('Удалить это обсуждение?', post.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deleteCommunityPost(post.ID)
            .then(() => router.back())
            .catch((e) => Alert.alert('Ошибка', apiError(e, 'Не удалось удалить обсуждение')));
        },
      },
    ]);
  };

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
        <ChevronLeft size={16} color={L.accent} />
        <Text style={styles.backText}>Назад</Text>
      </Pressable>
      {community ? (
        <Pressable
          onPress={() => router.push(`/community/${community.ID}` as Href)}
          hitSlop={8}
          style={styles.communityLink}>
          <Text style={styles.communityLinkText} numberOfLines={1}>
            {`← ${community.name}`}
          </Text>
        </Pressable>
      ) : null}
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

  if (invalidId || !post || !community) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {topBar}
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Обсуждение недоступно</Text>
          <Text style={styles.errorText}>Оно не существует или у вас нет доступа</Text>
          <Pressable
            onPress={() => router.replace('/community' as Href)}
            style={({ pressed }) => [styles.errorBtn, pressed && styles.pressed]}>
            <Text style={styles.errorBtnText}>К сообществам</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isModerator = canModerate(user?.role);
  const canDeletePost = isCommunityOwner || isModerator || user?.id === post.author_id;
  const meAvatar = user?.profile?.avatar_url || '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {topBar}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <PostCard
            post={post}
            full
            canDelete={canDeletePost}
            onDelete={confirmDeletePost}
          />

          <View style={styles.sectionHead}>
            <View style={styles.sectionBar} />
            <Text style={styles.sectionTitle}>Обсуждение</Text>
            <Text style={styles.sectionCount}>{`// ${comments.length}`}</Text>
            <View style={styles.sectionLine} />
          </View>

          {comments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyHead}>Пока нет сообщений</Text>
              <Text style={styles.emptyText}>Начните обсуждение первым</Text>
            </View>
          ) : (
            comments.map((comment) => {
              const name = authorName(comment.author);
              const avatar = avatarUri(comment.author);
              const canDelete = isCommunityOwner || isModerator || user?.id === comment.author_id;
              return (
                <View key={comment.ID} style={styles.comment}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.commentAvatar} />
                  ) : (
                    <View style={[styles.commentAvatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>{initials(name)}</Text>
                    </View>
                  )}
                  <View style={styles.commentBody}>
                    <View style={styles.commentHead}>
                      <View style={styles.commentNameRow}>
                        {isPro(comment.author) ? <Text style={styles.proChip}>PRO</Text> : null}
                        <Text style={styles.commentName} numberOfLines={1}>
                          {name}
                        </Text>
                      </View>
                      <View style={styles.commentMeta}>
                        <Text style={styles.commentDate}>{formatDateTime(comment.CreatedAt)}</Text>
                        {canDelete ? (
                          <Pressable
                            onPress={() => confirmDeleteComment(comment)}
                            hitSlop={8}
                            accessibilityLabel="Удалить сообщение">
                            <Trash size={14} color={L.muted} />
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                    <Text style={styles.commentText}>{comment.content}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composer}>
          {meAvatar ? (
            <Image source={{ uri: meAvatar }} style={styles.commentAvatar} />
          ) : (
            <View style={[styles.commentAvatar, styles.avatarFallback]}>
              <Text style={styles.avatarFallbackText}>{initials(user?.username || '?')}</Text>
            </View>
          )}
          <View style={styles.composerBody}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Написать в обсуждение..."
              placeholderTextColor={L.muted}
              multiline
              style={styles.composerInput}
            />
            <Pressable
              onPress={() => void send()}
              disabled={sending || !draft.trim()}
              style={[styles.sendBtn, (sending || !draft.trim()) && styles.sendBtnOff]}>
              <Send size={16} color="#0b0210" />
            </Pressable>
          </View>
        </View>
        {sendError ? <Text style={styles.sendError}>{sendError}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  pressed: { opacity: 0.8 },
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
  communityLink: { flex: 1 },
  communityLinkText: {
    color: L.muted,
    fontSize: 12, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },

  content: { padding: 16, gap: 12, paddingBottom: 24 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  sectionBar: { width: 4, height: 14, borderRadius: 0, backgroundColor: L.accent },
  sectionTitle: { color: L.text, fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },
  sectionCount: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  sectionLine: { flex: 1, height: 1, backgroundColor: L.border },

  emptyBox: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyHead: {
    color: L.muted,
    fontSize: 11, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  emptyText: { color: 'rgba(244,244,246,0.45)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },

  comment: { flexDirection: 'row', gap: 10 },
  commentAvatar: { width: 36, height: 36, borderRadius: 0 },
  avatarFallback: { backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', },
  commentBody: {
    flex: 1,
    minWidth: 0,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 12,
  },
  commentHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  proChip: {
    color: '#0b0210',
    backgroundColor: L.accent,
    fontSize: 10, fontFamily: 'Tiny5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  commentName: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commentDate: { color: 'rgba(244,244,246,0.6)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  commentText: { color: 'rgba(244,244,246,0.6)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginTop: 6 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: L.border,
    backgroundColor: L.card,
  },
  composerBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: L.cardAlt,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: L.text,
    fontSize: 14, fontFamily: 'JetBrainsMono_400Regular',
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: L.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.5 },
  sendError: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', paddingHorizontal: 16, paddingBottom: 10 },
}));
