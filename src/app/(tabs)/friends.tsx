import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import { FlatList, Image, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';

import { getOrCreateConversation } from '@/api/chat';
import {
  getFriends,
  getPendingRequests,
  removeFriend,
  type Friend,
} from '@/api/friends';
import { getPresence, usePresenceVersion } from '@/api/presence';
import PlayingCover from '@/components/PlayingCover';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

export default function FriendsScreen() {
  const [items, setItems] = useState<Friend[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null);
  const [busy, setBusy] = useState(false);
  // Перерисовка при изменении присутствия (онлайн-статус в реальном времени)
  usePresenceVersion();

  const load = useCallback(() => {
    setError('');
    Promise.all([getFriends(), getPendingRequests()])
      .then(([friends, requests]) => {
        setItems(friends);
        setPending(requests.incoming.length);
      })
      .catch((e) => setError(apiError(e, 'Не удалось загрузить друзей')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

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
    } catch (e) {
      setError(apiError(e, 'Не удалось открыть чат'));
    }
  };

  const openProfile = (friend: Friend) => {
    const u = friend.friend_details;
    if (u?.username) router.push(`/profile/${u.username}` as Href);
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    const friendId = removeTarget.friend_details?.id;
    if (!friendId) return;
    setBusy(true);
    try {
      await removeFriend(friendId);
      setItems((prev) => prev.filter((f) => f.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch (e) {
      setError(apiError(e, 'Не удалось удалить друга'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Друзья</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/friend-requests' as Href)}
            style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>
              Заявки{pending > 0 ? ` · ${pending}` : ''}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/friend-add' as Href)}
            style={[styles.headerBtn, styles.headerBtnAccent]}>
            <Text style={styles.headerBtnText}>Добавить</Text>
          </Pressable>
        </View>
      </View>

      {loading || error ? (
        <DataState loading={loading} error={error} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <DataState empty emptyText="Пока нет друзей. Добавь по коду друга." />
          }
          renderItem={({ item }) => {
            const u = item.friend_details;
            const presence = getPresence(u?.id ?? 0);
            const online = !!presence?.online || item.online_status === 'online';
            return (
              <Pressable
                onPress={() => openProfile(item)}
                onLongPress={() => setRemoveTarget(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <View style={styles.avatar}>
                  {u?.profile?.avatar_url ? (
                    <Image source={{ uri: u.profile.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>{(u?.username || '?')[0]?.toUpperCase()}</Text>
                  )}
                  <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{u?.profile?.display_name || u?.username || 'Друг'}</Text>
                  <Text style={[styles.rowSub, presence?.playing ? styles.rowSubPlaying : online && styles.rowSubOnline]} numberOfLines={1}>
                    {presence?.playing ? `Играет в ${presence.playing}` : online ? 'В сети' : 'Не в сети'}
                  </Text>
                </View>
                <PlayingCover presence={presence} />
                <Pressable onPress={() => void openChat(item)} style={styles.chatBtn} hitSlop={8}>
                  <Text style={styles.chatText}>Чат</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <Modal transparent animationType="fade" visible={!!removeTarget} onRequestClose={() => setRemoveTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setRemoveTarget(null)}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dialogTitle}>Удалить друга?</Text>
            <Text style={styles.dialogText}>
              {removeTarget?.friend_details?.profile?.display_name ||
                removeTarget?.friend_details?.username ||
                'Пользователь'}{' '}
              будет удалён из списка друзей.
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                style={[styles.dialogBtn, styles.dialogGhost]}
                onPress={() => setRemoveTarget(null)}>
                <Text style={styles.dialogGhostText}>Отмена</Text>
              </Pressable>
              <Pressable
                style={[styles.dialogBtn, styles.dialogDanger, busy && styles.disabled]}
                disabled={busy}
                onPress={() => void confirmRemove()}>
                <Text style={styles.dialogDangerText}>Удалить</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  title: { color: L.text, fontSize: 24, fontFamily: 'Tiny5', letterSpacing: 1 },
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  headerBtn: {
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerBtnAccent: { borderColor: L.borderStrong, backgroundColor: 'rgba(131,56,236,0.15)' },
  headerBtnText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  list: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 12 },
  rowPressed: { opacity: 0.7 },
  avatar: { width: 44, height: 44, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 44, height: 44 },
  avatarText: { color: L.text, fontSize: 18, fontFamily: 'Tiny5', },
  dot: { position: 'absolute', right: -2, bottom: -2, width: 12, height: 12, borderRadius: 0, borderWidth: 2, borderColor: L.card },
  dotOnline: { backgroundColor: L.success },
  dotOffline: { backgroundColor: L.muted },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },
  rowSub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  rowSubOnline: { color: L.success },
  rowSubPlaying: { color: L.accent },
  chatBtn: { borderWidth: 1, borderColor: L.borderStrong, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8 },
  chatText: { color: L.accent, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 340, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.borderStrong, padding: 22 },
  dialogTitle: { color: L.text, fontSize: 17, fontFamily: 'Tiny5', },
  dialogText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginTop: 8 },
  dialogActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  dialogBtn: { flex: 1, borderRadius: 0, paddingVertical: 13, alignItems: 'center' },
  dialogGhost: { borderWidth: 1, borderColor: L.border },
  dialogGhostText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  dialogDanger: { backgroundColor: L.danger },
  dialogDangerText: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', },
  disabled: { opacity: 0.5 },
}));
