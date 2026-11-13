import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import {
  acceptFriendRequest,
  deleteFriendRequest,
  getPendingRequests,
  type FriendUser,
  type PendingRequest,
} from '@/api/friends';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

export default function FriendRequestsScreen() {
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(0);

  const load = useCallback(() => {
    setError('');
    getPendingRequests()
      .then((r) => {
        setIncoming(r.incoming);
        setOutgoing(r.outgoing);
      })
      .catch((e) => setError(apiError(e, 'Не удалось загрузить заявки')))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const act = async (id: number, action: () => Promise<void>) => {
    setBusyId(id);
    setError('');
    try {
      await action();
      load();
    } catch (e) {
      setError(apiError(e, 'Не удалось выполнить действие'));
    } finally {
      setBusyId(0);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Заявки</Text>
      </View>

      {loading || error ? (
        <DataState loading={loading} error={error} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.section}>Входящие</Text>
          {incoming.length === 0 ? (
            <Text style={styles.empty}>Нет входящих заявок</Text>
          ) : (
            incoming.map((req) => (
              <RequestRow
                key={req.id}
                user={req.sender_details}
                busy={busyId === req.id}
                actionLabel="Принять"
                secondaryLabel="Отклонить"
                onAction={() => act(req.id, () => acceptFriendRequest(req.id))}
                onSecondary={() => act(req.id, () => deleteFriendRequest(req.id))}
              />
            ))
          )}

          <Text style={[styles.section, styles.sectionSpaced]}>Исходящие</Text>
          {outgoing.length === 0 ? (
            <Text style={styles.empty}>Нет исходящих заявок</Text>
          ) : (
            outgoing.map((req) => (
              <RequestRow
                key={req.id}
                user={req.receiver_details}
                busy={busyId === req.id}
                actionLabel="Отменить"
                onAction={() => act(req.id, () => deleteFriendRequest(req.id))}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function RequestRow({
  user,
  busy,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
}: {
  user?: FriendUser;
  busy: boolean;
  actionLabel: string;
  secondaryLabel?: string;
  onAction: () => void;
  onSecondary?: () => void;
}) {
  const name = user?.profile?.display_name || user?.username || 'Пользователь';
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        {user?.profile?.avatar_url ? (
          <Image source={{ uri: user.profile.avatar_url }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>{(user?.username || '?')[0]?.toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>@{user?.username || '—'}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          onPress={onAction}
          disabled={busy}
          style={[styles.primary, busy && styles.disabled]}>
          <Text style={styles.primaryText}>{actionLabel}</Text>
        </Pressable>
        {secondaryLabel && onSecondary ? (
          <Pressable
            onPress={onSecondary}
            disabled={busy}
            style={[styles.ghost, busy && styles.disabled]}>
            <Text style={styles.ghostText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 16, paddingBottom: 48 },
  section: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 },
  sectionSpaced: { marginTop: 24 },
  empty: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 42, height: 42 },
  avatarText: { color: L.text, fontSize: 17, fontFamily: 'Tiny5', },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  rowSub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  rowActions: { gap: 6, alignItems: 'flex-end' },
  primary: { backgroundColor: L.accent, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 7 },
  primaryText: { color: '#fff', fontSize: 11, fontFamily: 'Tiny5', },
  ghost: { borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 7 },
  ghostText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  disabled: { opacity: 0.5 },
}));
