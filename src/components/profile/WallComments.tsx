import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { CornerDownRight, Heart, Send, Trash, X } from 'lucide-react-native';

import {
  deleteWallComment,
  getWallComments,
  postWallComment,
  toggleCommentLike,
  type WallComment,
} from '@/api/comments';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

type Props = {
  profileId: number;
  /** Удаление своих комментариев доступно владельцу профиля. */
  canDelete?: boolean;
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');

/** Стена профиля: список комментариев, ответы, лайки, добавление и удаление. */
export default function WallComments({ profileId, canDelete = false }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<WallComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<WallComment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getWallComments(profileId)
      .then((list) => {
        if (!alive) return;
        setComments(list);
        setError('');
      })
      .catch((e) => {
        if (alive) setError(apiError(e, 'Не удалось загрузить комментарии'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [profileId]);

  const { roots, repliesOf } = useMemo(() => {
    const replies: Record<number, WallComment[]> = {};
    const rootList: WallComment[] = [];
    for (const c of comments) {
      if (c.parent_id && c.parent_id !== c.id) {
        (replies[c.parent_id] ||= []).push(c);
      } else {
        rootList.push(c);
      }
    }
    const sorted = rootList.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { roots: sorted, repliesOf: (id: number) => replies[id] || [] };
  }, [comments]);

  const handleDelete = (id: number) => {
    Alert.alert('Удалить комментарий', 'Удалить этот комментарий вместе с ответами?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deleteWallComment(id)
            .then(() => setComments((prev) => prev.filter((c) => c.id !== id && c.parent_id !== id)))
            .catch(() => Alert.alert('Ошибка', 'Не удалось удалить комментарий'));
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const created = await postWallComment(profileId, value);
      setComments((prev) => [created, ...prev]);
      setText('');
    } catch (e) {
      Alert.alert('Ошибка', apiError(e, 'Не удалось отправить комментарий'));
    } finally {
      setSending(false);
    }
  };

  const handleReply = async () => {
    if (!replyTo || !replyText.trim() || replyBusy) return;
    setReplyBusy(true);
    try {
      const created = await postWallComment(profileId, replyText.trim(), replyTo.id);
      setComments((prev) => [...prev, created]);
      setReplyText('');
      setReplyTo(null);
    } catch (e) {
      Alert.alert('Ошибка', apiError(e, 'Не удалось отправить ответ'));
    } finally {
      setReplyBusy(false);
    }
  };

  const handleLike = async (c: WallComment) => {
    setComments((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)),
    );
    try {
      const res = await toggleCommentLike(c.id);
      setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, liked: res.liked, likes: res.likes } : x)));
    } catch {
      setComments((prev) => prev.map((x) => (x.id === c.id ? { ...x, liked: c.liked, likes: c.likes } : x)));
    }
  };

  const renderComment = (c: WallComment, isReply = false) => {
    const authorName = c.author?.profile?.display_name || c.author?.username || 'Пользователь';
    const avatarUrl = c.author?.profile?.avatar_url || '';
    return (
      <View key={c.id} style={[styles.comment, isReply && styles.commentReply]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={[styles.commentAvatar, isReply && styles.commentAvatarSmall]} />
        ) : (
          <View style={[styles.commentAvatar, styles.commentAvatarFallback, isReply && styles.commentAvatarSmall]}>
            <Text style={styles.commentAvatarText}>{(c.author?.username || '?')[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.commentBody}>
          <View style={styles.commentHead}>
            <View style={styles.commentNameRow}>
              {c.author?.profile?.is_pro ? <Text style={styles.proChip}>PRO</Text> : null}
              <Text style={styles.commentName} numberOfLines={1}>
                {authorName}
              </Text>
            </View>
            <View style={styles.commentMeta}>
              <Text style={styles.commentDate}>{fmtDate(c.created_at)}</Text>
              {canDelete && (
                <Pressable onPress={() => handleDelete(c.id)} hitSlop={8} accessibilityLabel="Удалить комментарий">
                  <Trash size={14} color={L.muted} />
                </Pressable>
              )}
            </View>
          </View>

          <Text style={styles.commentText}>{c.content}</Text>

          <View style={styles.commentActions}>
            <Pressable onPress={() => void handleLike(c)} style={styles.actionBtn} hitSlop={6}>
              <Heart size={13} color={c.liked ? L.accent : L.muted} fill={c.liked ? L.accent : 'transparent'} />
              <Text style={[styles.actionText, c.liked && styles.actionTextActive]}>
                {c.likes > 0 ? c.likes : 'Нравится'}
              </Text>
            </Pressable>
            {!isReply && (
              <Pressable
                onPress={() => {
                  setReplyTo(c);
                  setReplyText('');
                }}
                style={styles.actionBtn}
                hitSlop={6}>
                <CornerDownRight size={13} color={L.muted} />
                <Text style={styles.actionText}>Ответить</Text>
              </Pressable>
            )}
          </View>

          {!isReply && repliesOf(c.id).length > 0 && (
            <View style={styles.replies}>{repliesOf(c.id).map((r) => renderComment(r, true))}</View>
          )}
        </View>
      </View>
    );
  };

  const meAvatar = user?.profile?.avatar_url || '';

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>СТЕНА ПРОФИЛЯ</Text>
        <View style={styles.countChip}>
          <Text style={styles.countText}>{roots.length}</Text>
        </View>
      </View>

      <View style={styles.composer}>
        {meAvatar ? (
          <Image source={{ uri: meAvatar }} style={styles.composerAvatar} />
        ) : (
          <View style={[styles.composerAvatar, styles.commentAvatarFallback]}>
            <Text style={styles.commentAvatarText}>{(user?.username || '?')[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.composerBody}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Добавить комментарий..."
            placeholderTextColor={L.muted}
            multiline
            style={styles.composerInput}
          />
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={sending || !text.trim()}
            style={[styles.sendBtn, (sending || !text.trim()) && styles.sendBtnDisabled]}>
            {sending ? <ActivityIndicator size="small" color="#0b0210" /> : <Send size={16} color="#0b0210" />}
          </Pressable>
        </View>
      </View>

      {replyTo && (
        <View style={styles.replyBox}>
          <View style={styles.replyHead}>
            <CornerDownRight size={12} color={L.accent} />
            <Text style={styles.replyLabel} numberOfLines={1}>
              Ответ для {replyTo.author?.profile?.display_name || replyTo.author?.username}
            </Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <X size={14} color={L.muted} />
            </Pressable>
          </View>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Ваш ответ..."
            placeholderTextColor={L.muted}
            multiline
            style={styles.replyInput}
          />
          <Pressable
            onPress={() => void handleReply()}
            disabled={replyBusy || !replyText.trim()}
            style={[styles.replySend, (replyBusy || !replyText.trim()) && styles.sendBtnDisabled]}>
            <Text style={styles.replySendText}>{replyBusy ? 'Отправка…' : 'Ответить'}</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={L.accent} style={styles.loader} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : roots.length === 0 ? (
        <Text style={styles.empty}>Комментариев пока нет — будьте первым.</Text>
      ) : (
        <View style={styles.list}>{roots.map((c) => renderComment(c))}</View>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  panel: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 16,
    marginTop: 20,
    marginHorizontal: 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: L.border,
    marginBottom: 16,
  },
  headTitle: { color: L.text, fontSize: 12, fontFamily: 'Tiny5', letterSpacing: 1.5 },
  countChip: { borderWidth: 1, borderColor: L.borderStrong, borderRadius: 0, paddingHorizontal: 8, paddingVertical: 1 },
  countText: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },

  composer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  composerAvatar: { width: 40, height: 40, borderRadius: 0, borderWidth: 1, borderColor: L.borderStrong },
  composerBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  composerInput: {
    flex: 1,
    minHeight: 72,
    maxHeight: 140,
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
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: L.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },

  replyBox: {
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: 'rgba(255,0,110,0.05)',
    borderRadius: 0,
    padding: 12,
    marginBottom: 16,
    marginLeft: 24,
    gap: 8,
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  replyLabel: { color: L.accent, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, flex: 1 },
  replyInput: {
    minHeight: 56,
    backgroundColor: L.cardAlt,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: L.text,
    fontSize: 14, fontFamily: 'JetBrainsMono_400Regular',
    textAlignVertical: 'top',
  },
  replySend: {
    alignSelf: 'flex-end',
    backgroundColor: L.accent,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  replySendText: { color: '#0b0210', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },

  comment: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentReply: { marginLeft: 36, marginTop: 10, marginBottom: 0 },
  commentAvatar: { width: 40, height: 40, borderRadius: 0, borderWidth: 1, borderColor: L.border },
  commentAvatarSmall: { width: 28, height: 28, borderRadius: 0 },
  commentAvatarFallback: { backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', },
  commentBody: {
    flex: 1,
    minWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,0,110,0.12)',
    paddingBottom: 12,
  },
  commentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
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
  commentName: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  commentDate: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  commentText: { color: '#d9c4d3', fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  actionTextActive: { color: L.accent },
  replies: { marginTop: 6 },

  list: { gap: 4 },
  loader: { marginTop: 20 },
  empty: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },
  errorText: { color: L.danger, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginTop: 8 },
}));
