import { themedStyles } from '@/theme/themedStyles';
import { Pressable, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react-native';

import {
  acceptVoiceInvite, clearVoiceNotice, declineVoiceInvite, leaveVoiceChannel, toggleVoiceMute, useVoice,
} from '@/api/voiceChannel';
import { L } from '@/constants/lustre';

/**
 * Полоса голосового канала поверх приложения (как VoiceConnectedBar и VoiceInviteToast
 * в лаунчере): приглашение, уведомление или «вы в канале» с быстрыми кнопками.
 */
export default function VoiceBar() {
  const v = useVoice();
  const insets = useSafeAreaInsets();
  // полоса стоит над экранами — отступ под системную строку состояния
  const top = { paddingTop: insets.top + 8 };

  if (v.invite) {
    const by = v.invite.by?.display_name || v.invite.by?.username || 'Друг';
    return (
      <View style={[styles.bar, styles.invite, top]}>
        <Text style={styles.text} numberOfLines={2}>
          {by} зовёт в «{v.invite.channel.name}» · {v.invite.community_name}
        </Text>
        <Pressable onPress={declineVoiceInvite} style={styles.ghost} hitSlop={6}>
          <Text style={styles.ghostText}>Нет</Text>
        </Pressable>
        <Pressable
          onPress={() => void acceptVoiceInvite().then(() => router.push('/voice' as Href))}
          style={styles.primary}
          hitSlop={6}>
          <Text style={styles.primaryText}>Зайти</Text>
        </Pressable>
      </View>
    );
  }

  if (v.notice && v.status === 'idle') {
    return (
      <Pressable onPress={clearVoiceNotice} style={[styles.bar, styles.notice, top]}>
        <Text style={styles.text}>{v.notice}</Text>
      </Pressable>
    );
  }

  if (v.status === 'idle') return null;

  const muted = v.selfMute || v.serverMute;
  return (
    <Pressable onPress={() => router.push('/voice' as Href)} style={[styles.bar, styles.connected, top]} accessibilityLabel="Открыть голосовой канал">
      <Volume2 size={14} color={L.success} />
      <View style={styles.flex}>
        <Text style={styles.text} numberOfLines={1}>
          {v.status === 'connecting' ? 'Подключение к ' : ''}«{v.channelName}»
        </Text>
        {v.notice ? <Text style={styles.sub} numberOfLines={1}>{v.notice}</Text> : <Text style={styles.sub} numberOfLines={1}>{v.communityName}</Text>}
      </View>
      <Pressable onPress={toggleVoiceMute} hitSlop={8} style={styles.icon} accessibilityLabel={muted ? 'Включить микрофон' : 'Выключить микрофон'}>
        {muted ? <MicOff size={16} color={L.danger} /> : <Mic size={16} color="#fff" />}
      </Pressable>
      <Pressable onPress={() => void leaveVoiceChannel()} hitSlop={8} style={styles.icon} accessibilityLabel="Выйти из канала">
        <PhoneOff size={16} color={L.danger} />
      </Pressable>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  connected: { backgroundColor: '#0d1a12', borderBottomColor: 'rgba(52,211,153,0.35)' },
  invite: { backgroundColor: '#1a0d18', borderBottomColor: 'rgba(255,0,110,0.4)' },
  notice: { backgroundColor: L.card, borderBottomColor: L.border },
  flex: { flex: 1 },
  text: { flexShrink: 1, color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold' },
  sub: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  icon: { padding: 4 },
  ghost: { paddingHorizontal: 10, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.border },
  ghostText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  primary: { paddingHorizontal: 12, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: L.accent },
  primaryText: { color: '#0b0210', fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase' },
}));
