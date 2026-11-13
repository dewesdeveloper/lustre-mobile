import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';

import { createGroup } from '@/api/groups';
import { getFriends, type Friend } from '@/api/friends';
import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

export default function CreateGroupScreen() {
  const [name, setName] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError('');
    getFriends()
      .then(setFriends)
      .catch((e) => setError(apiError(e, 'Не удалось загрузить друзей')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Введите название группы');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await createGroup({ name: trimmed, member_ids: [...selected] });
      router.replace({ pathname: '/chat/group/[id]', params: { id: String(res.id), name: trimmed } });
    } catch (e) {
      setError(apiError(e, 'Не удалось создать группу'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <ArrowLeft size={20} color={L.text} />
        </Pressable>
        <Text style={styles.title}>Новая группа</Text>
      </View>

      <View style={styles.body}>
        <Label>Название</Label>
        <Input value={name} onChangeText={setName} placeholder="Название группы" maxLength={60} />

        <Label>Участники</Label>
        {loading ? (
          <DataState loading />
        ) : friends.length === 0 ? (
          <Text style={styles.empty}>Сначала добавьте друзей — их можно включить в группу.</Text>
        ) : (
          <FlatList
            style={styles.flex}
            data={friends}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const u = item.friend_details;
              const checked = selected.has(u?.id);
              return (
                <Pressable
                  onPress={() => u?.id && toggle(u.id)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <View style={styles.avatar}>
                    {u?.profile?.avatar_url ? (
                      <Image source={{ uri: u.profile.avatar_url }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>{(u?.username || '?')[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {u?.profile?.display_name || u?.username || 'Друг'}
                  </Text>
                  <View style={[styles.check, checked && styles.checkOn]}>
                    {checked ? <Check size={13} color="#fff" /> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        <ErrorText>{error}</ErrorText>
        <Button title="Создать" onPress={create} loading={creating} />
      </View>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  body: { flex: 1, paddingHorizontal: 24 },
  flex: { flex: 1, marginTop: 8 },
  empty: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginTop: 8, lineHeight: 19 },
  list: { gap: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 12 },
  rowPressed: { opacity: 0.7 },
  avatar: { width: 40, height: 40, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 40, height: 40 },
  avatarText: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', },
  rowName: { flex: 1, minWidth: 0, color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  check: { width: 22, height: 22, borderRadius: 0, borderWidth: 1, borderColor: L.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: L.accent, borderColor: L.accent },
}));
