import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Users, X } from 'lucide-react-native';
import { getConversations, type ChatConversation } from '@/api/chat';
import { getGroups, type GroupSummary } from '@/api/groups';
import { L } from '@/constants/lustre';

interface ForwardPickerDialogProps {
  visible: boolean;
  count: number;
  onPick: (targetType: 'dm' | 'group', targetId: number) => void;
  onClose: () => void;
}

/** Выбор цели пересылки: список диалогов и групп. */
export const ForwardPickerDialog = ({ visible, count, onPick, onClose }: ForwardPickerDialogProps) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visible || loaded) return;
    let alive = true;
    Promise.all([getConversations(), getGroups()])
      .then(([convs, grps]) => {
        if (!alive) return;
        setConversations(convs);
        setGroups(grps);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [visible, loaded]);

  const loading = visible && !loaded;

  type Row = { key: string; conv?: ChatConversation; group?: GroupSummary };
  const rows: Row[] = [
    ...conversations.map((conv) => ({ key: `dm:${conv.id}`, conv })),
    ...groups.map((group) => ({ key: `group:${group.id}`, group })),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Переслать — {count}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={16} color={L.muted} />
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={L.accent} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.key}
              style={styles.list}
              renderItem={({ item }) =>
                item.conv ? (
                  <Pressable
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => onPick('dm', item.conv!.id)}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {item.conv.other_user?.username || 'Пользователь'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => onPick('group', item.group!.id)}>
                    <Users size={13} color={L.muted} />
                    <Text style={styles.rowLabel} numberOfLines={1}>{item.group!.name}</Text>
                  </Pressable>
                )
              }
              ListEmptyComponent={<Text style={styles.empty}>Нет доступных чатов</Text>}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = themedStyles(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    backgroundColor: '#0d0a14',
    borderWidth: 1,
    borderColor: L.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: L.border,
  },
  title: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rowLabel: { color: 'rgba(226,226,226,0.85)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', flexShrink: 1 },
  empty: {
    color: 'rgba(226,226,226,0.6)',
    fontSize: 11,
    fontFamily: 'JetBrainsMono_400Regular',
    textAlign: 'center',
    paddingVertical: 24,
  },
}));
