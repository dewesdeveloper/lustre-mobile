import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Headphones, Mic, MicOff, PhoneOff, Send, UserPlus, X } from 'lucide-react-native';

import api from '@/api/client';
import { onChatEvent } from '@/api/chat';
import { getPresence } from '@/api/presence';
import {
  deleteVoiceChatMessage, getVoiceChatHistory, inviteToVoiceChannel, leaveVoiceChannel, membersOf, moderateVoice,
  sendVoiceChat, toggleVoiceDeaf, toggleVoiceMute, useVoice,
  type VoiceChatMessage, type VoiceMember,
} from '@/api/voiceChannel';
import VoiceAvatar from '@/components/voice/VoiceAvatar';
import { canModerate } from '@/utils/roles';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

/** Экран голосового канала: участники, управление звуком, приглашения и чат канала. */
export default function VoiceRoomScreen() {
  const voice = useVoice();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const channelId = voice.channelId;
  const communityId = voice.communityId;
  const members = channelId && communityId ? membersOf(communityId, channelId) : [];
  const canManage = !!(communityId && voice.communities[communityId]?.canManage);

  // вышли из канала (сами, кик, удаление) — экран больше не нужен
  useEffect(() => {
    if (voice.status === 'idle' && router.canGoBack()) router.back();
  }, [voice.status]);

  const memberMenu = (m: VoiceMember) => {
    if (!canManage || m.user_id === voice.selfId) return;
    const name = m.user.display_name || m.user.username;
    Alert.alert(name, 'Модерация голосового канала', [
      { text: m.server_mute ? 'Разрешить микрофон' : 'Выключить микрофон', onPress: () => moderateVoice(m.user_id, m.server_mute ? 'unmute' : 'mute') },
      { text: 'Отключить от канала', style: 'destructive', onPress: () => moderateVoice(m.user_id, 'disconnect') },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  if (!channelId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Вы не в голосовом канале.</Text>
          <Pressable onPress={() => router.back()} style={styles.ghostBtn}><Text style={styles.ghostText}>Назад</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <ChevronLeft size={16} color={L.accent} />
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{voice.channelName}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {voice.communityName} · {voice.status === 'connecting' ? 'подключение…' : `в канале: ${members.length}`}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.members}>
          {members.map((m) => {
            const speaking = voice.speaking.includes(m.user_id) || (m.user_id === voice.selfId && voice.localSpeaking);
            return (
              <Pressable key={m.user_id} onLongPress={() => memberMenu(m)} style={styles.member}>
                <VoiceAvatar user={m.user} size={52} speaking={speaking} />
                <Text style={styles.memberName} numberOfLines={1}>{m.user.display_name || m.user.username}</Text>
                <View style={styles.memberIcons}>
                  {m.server_mute || m.self_mute ? <MicOff size={11} color={m.server_mute ? L.danger : L.muted} /> : null}
                  {m.self_deaf ? <Headphones size={11} color={L.muted} /> : null}
                </View>
              </Pressable>
            );
          })}
          {voice.status === 'connecting' ? <ActivityIndicator color={L.accent} style={styles.spinner} /> : null}
        </ScrollView>

        <View style={styles.controls}>
          <Ctrl
            label={voice.serverMute ? 'Выкл. модер.' : voice.selfMute ? 'Микрофон' : 'Микрофон'}
            on={!voice.selfMute && !voice.serverMute}
            danger={voice.selfMute || voice.serverMute}
            icon={voice.selfMute || voice.serverMute ? <MicOff size={18} color="#fff" /> : <Mic size={18} color="#fff" />}
            onPress={toggleVoiceMute}
          />
          <Ctrl
            label="Не слышать"
            on={voice.selfDeaf}
            danger={voice.selfDeaf}
            icon={<Headphones size={18} color="#fff" />}
            onPress={toggleVoiceDeaf}
          />
          <Ctrl label="Пригласить" icon={<UserPlus size={18} color="#fff" />} onPress={() => setInviteOpen(true)} />
          <Ctrl label="Выйти" danger icon={<PhoneOff size={18} color="#fff" />} onPress={() => void leaveVoiceChannel()} />
        </View>
        {canManage ? <Text style={styles.hint}>Долгое нажатие на участника — модерация</Text> : null}

        <VoiceChat channelId={channelId} meId={voice.selfId} canDeleteAny={canManage || canModerate(user?.role)} />
      </KeyboardAvoidingView>

      <InviteDialog
        visible={inviteOpen}
        channelId={channelId}
        memberIds={members.map((m) => m.user_id)}
        onClose={() => setInviteOpen(false)}
      />
    </SafeAreaView>
  );
}

function Ctrl({ label, icon, onPress, on, danger }: { label: string; icon: React.ReactNode; onPress: () => void; on?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.ctrl} accessibilityLabel={label}>
      <View style={[styles.ctrlBtn, on && styles.ctrlOn, danger && styles.ctrlDanger]}>{icon}</View>
      <Text style={styles.ctrlLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Текстовый чат голосового канала (живые сообщения — по WS). */
function VoiceChat({ channelId, meId, canDeleteAny }: { channelId: number; meId: number; canDeleteAny: boolean }) {
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<VoiceChatMessage>>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getVoiceChatHistory(channelId)
        .then((m) => { if (alive) setMessages(m); })
        .catch(() => {});
    const kickoff = setTimeout(() => {
      setMessages([]);
      setError('');
      void load();
    }, 0);
    const off = onChatEvent((raw) => {
      const d = raw as Record<string, any>;
      if (d.type === '__open') { void load(); return; }
      if (d.channel_id !== channelId) return;
      if (d.type === 'voice.chat') {
        const msg = d.message as VoiceChatMessage;
        setMessages((prev) => (prev.some((m) => m.ID === msg.ID) ? prev : [...prev, msg]));
      } else if (d.type === 'voice.chat.deleted') {
        setMessages((prev) => prev.filter((m) => m.ID !== d.message_id));
      } else if (d.type === 'chat.rate_limited') {
        setError(d.error || 'Слишком часто — подождите немного');
      }
    });
    return () => { alive = false; clearTimeout(kickoff); off(); };
  }, [channelId]);

  const submit = () => {
    const content = text.trim();
    if (!content) return;
    if (!sendVoiceChat(channelId, content)) {
      setError('Нет соединения с сервером');
      return;
    }
    setError('');
    setText('');
  };

  const remove = (m: VoiceChatMessage) => {
    Alert.alert('Удалить сообщение?', m.content.slice(0, 120), [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => void deleteVoiceChatMessage(m.ID)
          .then(() => setMessages((prev) => prev.filter((x) => x.ID !== m.ID)))
          .catch((e) => setError(apiError(e, 'Не удалось удалить'))),
      },
    ]);
  };

  return (
    <View style={styles.chat}>
      <Text style={styles.chatHead}>Чат канала</Text>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.ID)}
        style={styles.flex}
        contentContainerStyle={styles.chatList}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={styles.chatEmpty}>Сообщений пока нет</Text>}
        renderItem={({ item: m }) => (
          <Pressable onLongPress={() => (m.author_id === meId || canDeleteAny) && remove(m)} style={styles.msg}>
            <Text style={styles.msgAuthor}>{m.author?.profile?.display_name || m.author?.username || 'Игрок'}</Text>
            <Text style={styles.msgText}>{m.content}</Text>
          </Pressable>
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Сообщение в канал…"
          placeholderTextColor={L.muted}
          maxLength={2000}
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable onPress={submit} disabled={!text.trim()} style={[styles.send, !text.trim() && styles.disabled]} accessibilityLabel="Отправить">
          <Send size={16} color="#0b0210" />
        </Pressable>
      </View>
    </View>
  );
}

type Friend = { id: number; friend_details?: { id: number; username: string; profile?: { display_name?: string; avatar_url?: string } } };

/** Пригласить друзей в канал (как VoiceInviteDialog в лаунчере). */
function InviteDialog({ visible, channelId, memberIds, onClose }: { visible: boolean; channelId: number; memberIds: number[]; onClose: () => void }) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [status, setStatus] = useState<Record<number, { state: 'sent' | 'failed'; error?: string }>>({});

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setStatus({});
      api.get('/friends/list')
        .then((r) => setFriends(Array.isArray(r.data) ? r.data : []))
        .catch(() => setFriends([]));
    }, 0);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => onChatEvent((raw) => {
    const d = raw as Record<string, any>;
    if (d.type === 'voice.invite.sent') setStatus((p) => ({ ...p, [d.target_user_id]: { state: 'sent' } }));
    else if (d.type === 'voice.invite.failed') setStatus((p) => ({ ...p, [d.target_user_id]: { state: 'failed', error: d.error || 'Не удалось пригласить' } }));
  }), []);

  const list = useMemo(
    () => (friends ?? [])
      .filter((f) => f.friend_details && !memberIds.includes(f.friend_details.id))
      .sort((a, b) => Number(!getPresence(a.friend_details!.id)?.online) - Number(!getPresence(b.friend_details!.id)?.online)),
    [friends, memberIds],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          <View style={styles.dialogHead}>
            <Text style={styles.dialogTitle}>Пригласить в канал</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Закрыть"><X size={18} color={L.muted} /></Pressable>
          </View>
          {friends === null ? <ActivityIndicator color={L.accent} style={styles.spinner} /> : null}
          {friends && list.length === 0 ? <Text style={styles.chatEmpty}>Некого пригласить</Text> : null}
          <ScrollView style={styles.inviteList}>
            {list.map((f) => {
              const u = f.friend_details!;
              const st = status[u.id];
              const online = !!getPresence(u.id)?.online;
              return (
                <View key={u.id} style={styles.inviteRow}>
                  <VoiceAvatar user={{ id: u.id, username: u.username, display_name: u.profile?.display_name, avatar_url: u.profile?.avatar_url }} size={30} />
                  <View style={styles.flex}>
                    <Text style={styles.inviteName} numberOfLines={1}>{u.profile?.display_name || u.username}</Text>
                    <Text style={[styles.inviteSub, st?.state === 'failed' && { color: L.danger }]} numberOfLines={1}>
                      {st?.state === 'sent' ? 'Приглашение отправлено' : st?.error || (online ? 'В сети' : 'Не в сети')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => { if (!inviteToVoiceChannel(channelId, u.id)) setStatus((p) => ({ ...p, [u.id]: { state: 'failed', error: 'Нет соединения' } })); }}
                    disabled={st?.state === 'sent'}
                    style={[styles.inviteBtn, st?.state === 'sent' && styles.disabled]}>
                    <Text style={styles.inviteBtnText}>{st?.state === 'sent' ? 'Готово' : 'Позвать'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  flex: { flex: 1 },
  head: { paddingHorizontal: 16, paddingTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: L.text, fontSize: 20, fontFamily: 'Tiny5', textTransform: 'uppercase' },
  sub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 4 },
  members: { paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  member: { width: 64, alignItems: 'center', gap: 4 },
  memberName: { color: L.text, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', maxWidth: 64 },
  memberIcons: { flexDirection: 'row', gap: 3, height: 12 },
  spinner: { marginVertical: 12 },
  controls: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 6 },
  ctrl: { alignItems: 'center', gap: 4, width: 76 },
  ctrlBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: L.cardAlt, borderWidth: 1, borderColor: L.border },
  ctrlOn: { borderColor: L.success },
  ctrlDanger: { backgroundColor: L.danger, borderColor: L.danger },
  ctrlLabel: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold' },
  hint: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginBottom: 4 },
  chat: { flex: 1, borderTopWidth: 1, borderTopColor: L.border, marginTop: 6 },
  chatHead: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 10 },
  chatList: { padding: 16, paddingTop: 8, gap: 8 },
  chatEmpty: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', paddingVertical: 16 },
  msg: { gap: 2 },
  msgAuthor: { color: L.accent, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  msgText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },
  error: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', paddingHorizontal: 16 },
  composer: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: L.border },
  input: { flex: 1, backgroundColor: L.cardAlt, borderWidth: 1, borderColor: L.border, paddingHorizontal: 12, paddingVertical: 9, color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  send: { width: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: L.accent },
  disabled: { opacity: 0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  emptyText: { color: L.muted, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular' },
  ghostBtn: { paddingHorizontal: 16, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.border },
  ghostText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 400, maxHeight: '75%', backgroundColor: L.card, borderWidth: 1, borderColor: L.borderStrong, padding: 16, gap: 10 },
  dialogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogTitle: { color: L.text, fontSize: 14, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  inviteList: { flexGrow: 0 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  inviteName: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold' },
  inviteSub: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  inviteBtn: { backgroundColor: L.accent, paddingHorizontal: 12, height: 32, alignItems: 'center', justifyContent: 'center' },
  inviteBtnText: { color: '#0b0210', fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase' },
}));
