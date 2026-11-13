import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Mic, MicOff, Phone, PhoneOff, SwitchCamera, Users, Video, VideoOff } from 'lucide-react-native';

import {
  acceptGroupCall, clearGroupCallNotice, declineGroupCall, endGroupCall, leaveGroupCall,
  toggleGroupMute, toggleGroupVideo, switchGroupCamera,
  getLocalGroupVideoStream, getGroupParticipantStream,
} from '@/api/groupCall';
import { useGroupCall } from '@/hooks/use-call';
import ScreenVolumeControl from '@/components/ScreenVolumeControl';
import RtcVideoView, { isVideoSupported } from '@/components/RtcVideoView';
import { L } from '@/constants/lustre';

function formatDuration(startedAt: number | null): string {
  if (!startedAt) return '00:00';
  const total = Math.floor((Date.now() - startedAt) / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function Tile({ id, username, sendingVideo }: { id: number; username: string; sendingVideo: boolean }) {
  const stream = sendingVideo ? getGroupParticipantStream(id) : null;
  return (
    <View style={styles.tile}>
      {stream && isVideoSupported() ? (
        <RtcVideoView streamURL={stream.toURL()} style={styles.tileVideo} objectFit="cover" />
      ) : (
        <View style={[styles.tileVideo, styles.tileFallback]}>
          <Text style={styles.tileInitial}>{(username || '?')[0]?.toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.tileName} numberOfLines={1}>{username}</Text>
      <View style={styles.tileVolume}>
        <ScreenVolumeControl userId={id} compact />
      </View>
    </View>
  );
}

export default function GroupCallOverlay() {
  const call = useGroupCall();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (call.status !== 'active') return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [call.status]);
  void tick;

  if (call.status === 'idle') {
    if (!call.notice) return null;
    return (
      <Pressable style={styles.toast} onPress={clearGroupCallNotice}>
        <Text style={styles.toastText}>{call.notice}</Text>
      </Pressable>
    );
  }

  const isIncoming = call.status === 'incoming';
  const isActive = call.status === 'active';
  const localStream = getLocalGroupVideoStream();
  const showVideo = isActive && (call.videoEnabled || call.videoUsers.length > 0) && isVideoSupported();

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => (isIncoming ? declineGroupCall() : endGroupCall())}>
      <View style={styles.backdrop}>
        <View style={[styles.card, showVideo && styles.cardWide]}>
          <View style={styles.header}>
            <Users size={15} color={L.accent} />
            <Text style={styles.headerText} numberOfLines={1}>{call.groupName || 'Групповой звонок'}</Text>
            {isActive ? <Text style={styles.timer}>{formatDuration(call.startedAt)}</Text> : null}
          </View>

          {isIncoming ? (
            <View style={styles.incomingRow}>
              <View style={styles.bigAvatar}>
                <Text style={styles.bigAvatarText}>{(call.caller?.username || '?')[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.flexMin}>
                <Text style={styles.name}>{call.caller?.username}</Text>
                <Text style={styles.statusText}>Групповой звонок…</Text>
              </View>
            </View>
          ) : showVideo ? (
            <View style={styles.grid}>
              {call.videoEnabled && localStream ? (
                <View style={styles.tile}>
                  <RtcVideoView streamURL={localStream.toURL()} style={styles.tileVideo} objectFit="cover" mirror zOrder={1} />
                  <Text style={styles.tileName}>Вы</Text>
                </View>
              ) : null}
              {call.participants.map((p) => (
                <Tile key={p.id} id={p.id} username={p.username} sendingVideo={call.videoUsers.includes(p.id)} />
              ))}
            </View>
          ) : (
            <View style={styles.avatarsRow}>
              {call.participants.map((p) => (
                <View key={p.id} style={styles.avatarItem}>
                  <View style={styles.smallAvatar}>
                    <Text style={styles.smallAvatarText}>{(p.username || '?')[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.avatarName} numberOfLines={1}>{p.username}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            {isIncoming ? (
              <>
                <RoundButton color={L.danger} onPress={declineGroupCall} icon={<PhoneOff size={22} color="#fff" />} label="Отклонить" />
                <RoundButton color={L.success} onPress={acceptGroupCall} icon={<Phone size={22} color="#fff" />} label="Принять" />
              </>
            ) : (
              <>
                <RoundButton
                  color={call.micMuted ? L.cardAlt : L.violet}
                  onPress={toggleGroupMute}
                  icon={call.micMuted ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
                  label={call.micMuted ? 'Микрофон' : 'Микрофон'}
                />
                <RoundButton
                  color={call.videoEnabled ? L.accent : L.cardAlt}
                  onPress={() => void toggleGroupVideo()}
                  icon={call.videoEnabled ? <Video size={22} color="#fff" /> : <VideoOff size={22} color="#fff" />}
                  label="Видео"
                />
                {call.videoEnabled ? (
                  <RoundButton color={L.cardAlt} onPress={switchGroupCamera} icon={<SwitchCamera size={22} color="#fff" />} label="Сменить" />
                ) : null}
                <RoundButton color="#b45309" onPress={leaveGroupCall} icon={<PhoneOff size={20} color="#fff" />} label="Выйти" />
                <RoundButton color={L.danger} onPress={endGroupCall} icon={<PhoneOff size={22} color="#fff" />} label="Завершить" />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RoundButton({
  color,
  onPress,
  icon,
  label,
}: {
  color: string;
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action}>
      <View style={[styles.round, { backgroundColor: color }]}>{icon}</View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 360, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.borderStrong, padding: 20 },
  cardWide: { maxWidth: 420 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  headerText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', flex: 1 },
  timer: { color: L.muted, fontSize: 11, fontFamily: 'monospace' },

  incomingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigAvatar: { width: 56, height: 56, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { color: L.text, fontSize: 22, fontFamily: 'Tiny5', },
  name: { color: L.text, fontSize: 16, fontFamily: 'Tiny5', },
  statusText: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  flexMin: { flex: 1, minWidth: 0 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '47%', aspectRatio: 1, borderRadius: 0, overflow: 'hidden', backgroundColor: '#000' },
  tileVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  tileFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: L.cardAlt },
  tileInitial: { color: L.text, fontSize: 28, fontFamily: 'Tiny5', },
  tileVolume: { position: 'absolute', top: 4, right: 4 },
  tileName: { position: 'absolute', bottom: 4, left: 6, right: 6, color: '#fff', fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 0, overflow: 'hidden' },

  avatarsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  avatarItem: { alignItems: 'center', width: 64 },
  smallAvatar: { width: 48, height: 48, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { color: L.text, fontSize: 18, fontFamily: 'Tiny5', },
  avatarName: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 5, textAlign: 'center' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 20, justifyContent: 'center' },
  action: { alignItems: 'center', gap: 6 },
  round: { width: 56, height: 56, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  toast: { position: 'absolute', top: 64, left: 20, right: 20, backgroundColor: L.card, borderWidth: 1, borderColor: L.borderStrong, borderRadius: 0, padding: 14 },
  toastText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center' },
}));
