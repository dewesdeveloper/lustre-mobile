import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Headphones, MicOff, Plus, Volume2 } from 'lucide-react-native';

import {
  createVoiceChannel, deleteVoiceChannel, joinVoiceChannel, membersOf, useVoice, watchCommunity,
  type VoiceChannelInfo,
} from '@/api/voiceChannel';
import VoiceAvatar from '@/components/voice/VoiceAvatar';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

/**
 * Голосовые каналы сообщества (вкладка «Голос»): список каналов с участниками,
 * вход по нажатию. Владелец может создавать и удалять каналы.
 */
export default function VoiceChannelsSection({ communityId, communityName }: { communityId: number; communityName: string }) {
  const voice = useVoice();
  const info = voice.communities[communityId];
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => watchCommunity(communityId), [communityId]);

  if (!info?.loaded) return <ActivityIndicator color={L.accent} style={styles.spinner} />;

  const join = async (ch: VoiceChannelInfo) => {
    if (voice.channelId !== ch.id) await joinVoiceChannel(ch, communityName);
    router.push('/voice' as Href);
  };

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError('');
    try {
      await createVoiceChannel(communityId, n);
      setCreating(false);
      setName('');
    } catch (e) {
      setError(apiError(e, 'Не удалось создать канал'));
    } finally {
      setBusy(false);
    }
  };

  const remove = (ch: VoiceChannelInfo) => {
    if (!info.canManage) return;
    Alert.alert('Удалить канал?', `«${ch.name}» будет удалён, все участники отключатся.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => void deleteVoiceChannel(ch).catch((e) => Alert.alert('Не удалось удалить', apiError(e, 'Ошибка'))),
      },
    ]);
  };

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text style={styles.headText}>Голосовые каналы</Text>
        {info.canManage ? (
          <Pressable onPress={() => setCreating(true)} hitSlop={8} accessibilityLabel="Создать канал" style={styles.addBtn}>
            <Plus size={14} color={L.accent} />
            <Text style={styles.addText}>Канал</Text>
          </Pressable>
        ) : null}
      </View>

      {!info.livekit ? <Text style={styles.note}>Голосовые каналы недоступны: сервер звонков не настроен.</Text> : null}
      {info.livekit && !info.canJoin ? <Text style={styles.note}>Вступите в сообщество, чтобы заходить в голосовые каналы.</Text> : null}
      {info.channels.length === 0 ? <Text style={styles.note}>Каналов пока нет.</Text> : null}

      {info.channels.map((ch) => {
        const members = membersOf(communityId, ch.id);
        const here = voice.channelId === ch.id && voice.status !== 'idle';
        const full = ch.user_limit > 0 && members.length >= ch.user_limit && !here;
        return (
          <View key={ch.id} style={[styles.channel, here && styles.channelOn]}>
            <Pressable
              onPress={() => void join(ch)}
              onLongPress={() => remove(ch)}
              disabled={!info.livekit || !info.canJoin || full}
              style={({ pressed }) => [styles.channelRow, pressed && styles.pressed]}>
              <Volume2 size={16} color={here ? L.accent : L.muted} />
              <Text style={[styles.channelName, here && styles.channelNameOn]} numberOfLines={1}>{ch.name}</Text>
              <Text style={styles.count}>
                {members.length}{ch.user_limit > 0 ? `/${ch.user_limit}` : ''}
              </Text>
            </Pressable>
            {members.map((m) => {
              const speaking = voice.speaking.includes(m.user_id) || (m.user_id === voice.selfId && voice.localSpeaking);
              return (
                <View key={m.user_id} style={styles.member}>
                  <VoiceAvatar user={m.user} size={24} speaking={speaking} />
                  <Text style={styles.memberName} numberOfLines={1}>{m.user.display_name || m.user.username}</Text>
                  {m.server_mute || m.self_mute ? <MicOff size={12} color={m.server_mute ? L.danger : L.muted} /> : null}
                  {m.self_deaf ? <Headphones size={12} color={L.muted} /> : null}
                </View>
              );
            })}
          </View>
        );
      })}
      {info.canManage && info.channels.length > 0 ? <Text style={styles.hint}>Долгое нажатие на канал — удалить</Text> : null}

      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCreating(false)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <Text style={styles.dialogTitle}>Новый голосовой канал</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Название канала"
              placeholderTextColor={L.muted}
              maxLength={40}
              autoFocus
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setCreating(false)} style={styles.ghostBtn}>
                <Text style={styles.ghostText}>Отмена</Text>
              </Pressable>
              <Pressable onPress={() => void create()} disabled={busy || !name.trim()} style={[styles.primaryBtn, (busy || !name.trim()) && styles.disabled]}>
                {busy ? <ActivityIndicator size="small" color="#0b0210" /> : <Text style={styles.primaryText}>Создать</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = themedStyles(() => ({
  spinner: { marginVertical: 24 },
  box: { marginHorizontal: 16, marginTop: 8, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: L.border, paddingHorizontal: 10, paddingVertical: 6 },
  addText: { color: L.accent, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  note: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  hint: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginTop: 4 },
  channel: { borderWidth: 1, borderColor: L.border, backgroundColor: L.card },
  channelOn: { borderColor: L.accent },
  channelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  pressed: { opacity: 0.75 },
  channelName: { flex: 1, color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold' },
  channelNameOn: { color: L.accent },
  count: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 38, paddingRight: 12, paddingBottom: 8 },
  memberName: { flex: 1, color: 'rgba(244,244,246,0.8)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { width: '100%', maxWidth: 360, backgroundColor: L.card, borderWidth: 1, borderColor: L.borderStrong, padding: 16, gap: 12 },
  dialogTitle: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: L.cardAlt, borderWidth: 1, borderColor: L.border, paddingHorizontal: 12, paddingVertical: 10, color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular' },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  ghostBtn: { paddingHorizontal: 14, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.border },
  ghostText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  primaryBtn: { backgroundColor: L.accent, paddingHorizontal: 18, height: 38, alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  primaryText: { color: '#0b0210', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  disabled: { opacity: 0.5 },
}));
