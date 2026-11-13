import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Phone, Plus, Users } from 'lucide-react-native';

import { getConversations, wsDeleteConversation, type ChatConversation } from '@/api/chat';
import { deleteGroup, getGroups, hideGroup, type GroupSummary } from '@/api/groups';
import { useGroupActiveCalls } from '@/api/groupCallPresence';
import { getPresence, usePresenceVersion } from '@/api/presence';
import { useAuth } from '@/context/AuthContext';
import DataState from '@/components/ui/DataState';
import { DeleteConfirmDialog } from '@/components/chat/DeleteConfirmDialog';
import { apiError } from '@/utils/apiError';
import { dmPreview, formatTime } from '@/utils/chatFormat';
import { L } from '@/constants/lustre';

type Row =
  | { kind: 'dm'; key: string; t: number; conv: ChatConversation }
  | { kind: 'group'; key: string; t: number; group: GroupSummary };

export default function ChatsScreen() {
  const { user } = useAuth();
  const myId = user?.id ?? 0;
  const [items, setItems] = useState<ChatConversation[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const activeCalls = useGroupActiveCalls();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Удаление чата (долгое нажатие по строке)
  const [deletingRow, setDeletingRow] = useState<Row | null>(null);
  // Перерисовка при изменении присутствия (данные берём из общего стора)
  usePresenceVersion();

  const load = useCallback(() => {
    setError('');
    Promise.all([getConversations(), getGroups()])
      .then(([convs, grps]) => {
        setItems(convs);
        setGroups(grps);
      })
      .catch((e) => setError(apiError(e, 'Не удалось загрузить чаты')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const rows: Row[] = [
    ...items.map((conv) => ({
      kind: 'dm' as const,
      key: `dm:${conv.id}`,
      t: conv.last_message ? new Date(conv.last_message.created_at).getTime() : 0,
      conv,
    })),
    ...groups.map((group) => ({
      kind: 'group' as const,
      key: `group:${group.id}`,
      t: group.last_message ? new Date(group.last_message.created_at).getTime() : 0,
      group,
    })),
  ].sort((a, b) => b.t - a.t);

  const openDm = (c: ChatConversation) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: String(c.id),
        username: c.other_user?.username || 'Чат',
        otherId: String(c.other_user?.id ?? ''),
        avatar: c.other_user?.avatar_url || '',
      },
    });
  };

  const openGroup = (g: GroupSummary) => {
    router.push({ pathname: '/chat/group/[id]', params: { id: String(g.id), name: g.name } });
  };

  const confirmDeleteRow = async (forAll: boolean) => {
    const row = deletingRow;
    setDeletingRow(null);
    if (!row) return;
    try {
      if (row.kind === 'dm') {
        wsDeleteConversation(row.conv.id, forAll);
        setItems((prev) => prev.filter((c) => c.id !== row.conv.id));
      } else if (forAll) {
        await deleteGroup(row.group.id);
        setGroups((prev) => prev.filter((g) => g.id !== row.group.id));
      } else {
        await hideGroup(row.group.id);
        setGroups((prev) => prev.filter((g) => g.id !== row.group.id));
      }
    } catch {
      load();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Чаты — {rows.length}</Text>
        <Pressable onPress={() => router.push('/group-create' as Href)} style={styles.newGroupBtn}>
          <Plus size={13} color={L.accent} />
          <Text style={styles.newGroupText}>Группа</Text>
        </Pressable>
      </View>

      {loading || error ? (
        <DataState loading={loading} error={error} onRetry={load} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<DataState empty emptyText="Пока нет чатов" />}
          renderItem={({ item }) => {
            if (item.kind === 'group') {
              const g = item.group;
              const preview = g.last_message
                ? g.last_message.kind === 'image'
                  ? 'Изображение'
                  : g.last_message.kind === 'video'
                    ? 'Видео'
                    : g.last_message.kind === 'file'
                      ? g.last_message.attachment_name || 'Файл'
                      : g.last_message.content || 'Нет сообщений'
                : `${g.members_count} участников`;
              return (
                <Pressable
                  onPress={() => openGroup(g)}
                  onLongPress={() => setDeletingRow(item)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <View style={styles.avatarWrap}>
                    {g.avatar_url ? (
                      <Image source={{ uri: g.avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <View style={[styles.avatarImg, styles.avatarFallback]}>
                        <Users size={18} color={L.muted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowName} numberOfLines={1}>{g.name}</Text>
                      {activeCalls.has(g.id) ? <Phone size={11} color="#34d399" /> : null}
                      {g.last_message ? (
                        <Text style={styles.rowTime}>{formatTime(g.last_message.created_at)}</Text>
                      ) : null}
                    </View>
                    <View style={styles.rowBottom}>
                      <Text style={styles.rowPreview} numberOfLines={1}>{preview}</Text>
                      {g.unread > 0 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{g.unread}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            }

            const c = item.conv;
            const u = c.other_user;
            const presence = u?.id ? getPresence(u.id) : undefined;
            const online = !!presence?.online;
            const playing = presence?.playing;
            const preview = playing
              ? `Играет в ${playing}`
              : c.last_message
                ? dmPreview(c.last_message, myId)
                : 'Нет сообщений';
            return (
              <Pressable
                onPress={() => openDm(c)}
                onLongPress={() => setDeletingRow(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <View style={styles.avatarWrap}>
                  <Avatar url={u?.avatar_url} name={u?.username} />
                  <View
                    style={[
                      styles.dot,
                      playing ? styles.dotPlaying : online ? styles.dotOnline : styles.dotOffline,
                    ]}
                  />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {u?.username || 'Пользователь'}
                    </Text>
                    {c.last_message ? (
                      <Text style={styles.rowTime}>{formatTime(c.last_message.created_at)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.rowBottom}>
                    <Text
                      style={[styles.rowPreview, playing && styles.rowPreviewPlaying]}
                      numberOfLines={1}>
                      {preview}
                    </Text>
                    {c.unread > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{c.unread}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <DeleteConfirmDialog
        visible={!!deletingRow}
        title={deletingRow?.kind === 'group' ? 'Удалить группу' : 'Удалить чат'}
        message={
          deletingRow?.kind === 'group'
            ? deletingRow.group.owner_id === myId
              ? 'Группа и вся её история будут удалены у всех участников. Это действие нельзя отменить.'
              : 'Группа будет скрыта из списка. При новом сообщении она появится снова.'
            : 'Диалог и вся история будут удалены у вас и у собеседника. Это действие нельзя отменить.'
        }
        showForAll={deletingRow ? deletingRow.kind === 'dm' || deletingRow.group.owner_id === myId : false}
        onConfirm={(forAll) => void confirmDeleteRow(forAll)}
        onClose={() => setDeletingRow(null)}
      />
    </SafeAreaView>
  );
}

function Avatar({ url, name }: { url?: string; name?: string }) {
  if (url) return <Image source={{ uri: url }} style={styles.avatarImg} />;
  return (
    <View style={[styles.avatarImg, styles.avatarFallback]}>
      <Text style={styles.avatarText}>{(name || '?')[0]?.toUpperCase()}</Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: 'rgba(131,56,236,0.15)',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  newGroupText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  headerText: {
    color: 'rgba(226,226,226,0.6)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  list: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.03)' },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 40, height: 40, borderRadius: 0, backgroundColor: '#000' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: L.cardAlt },
  avatarText: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', },
  dot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 11,
    height: 11,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: L.bg,
  },
  dotPlaying: { backgroundColor: L.accent },
  dotOnline: { backgroundColor: '#22c55e' },
  dotOffline: { backgroundColor: 'rgba(226,226,226,0.2)' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  rowName: { color: 'rgba(244,244,246,0.85)', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', flexShrink: 1 },
  rowTime: { color: 'rgba(226,226,226,0.55)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', flexShrink: 0 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 3 },
  rowPreview: { color: 'rgba(226,226,226,0.6)', fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', flexShrink: 1 },
  rowPreviewPlaying: { color: L.accent },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 0,
    paddingHorizontal: 5,
    backgroundColor: L.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontFamily: 'Tiny5', },
}));
