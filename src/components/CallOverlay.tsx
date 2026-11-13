import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { Mic, MicOff, MonitorUp, Phone, PhoneOff, SwitchCamera, Video, VideoOff } from 'lucide-react-native';

import {
  acceptCall, clearCallNotice, declineCall, endCall, toggleMute,
  toggleVideo, switchCamera, toggleScreenShare,
  getLocalVideoStream, getRemoteVideoStream, getLocalScreenStream, getRemoteScreenStream,
} from '@/api/call';
import { useCall } from '@/hooks/use-call';
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

export default function CallOverlay() {
  const call = useCall();
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
      <Pressable style={styles.toast} onPress={clearCallNotice}>
        <Text style={styles.toastText}>{call.notice}</Text>
      </Pressable>
    );
  }

  const name = call.peer?.username || 'Пользователь';
  const isIncoming = call.status === 'incoming';
  const isActive = call.status === 'active';
  const remoteStream = getRemoteVideoStream();
  const localStream = getLocalVideoStream();
  const remoteScreen = getRemoteScreenStream();
  const localScreen = getLocalScreenStream();
  const showVideo = isActive && (call.videoEnabled || call.remoteVideo || call.sharingScreen || call.remoteScreen) && isVideoSupported();

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => (isIncoming ? declineCall() : endCall())}>
      <View style={styles.backdrop}>
        <View style={[styles.card, showVideo && styles.cardVideo]}>
          {showVideo ? (
            <View style={styles.videoArea}>
              {call.remoteScreen && remoteScreen ? (
                <RtcVideoView streamURL={remoteScreen.toURL()} style={styles.remoteVideo} objectFit="contain" />
              ) : call.sharingScreen && localScreen ? (
                <RtcVideoView streamURL={localScreen.toURL()} style={styles.remoteVideo} objectFit="contain" />
              ) : call.remoteVideo && remoteStream ? (
                <RtcVideoView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
              ) : (
                <View style={[styles.remoteVideo, styles.avatarBig]}>
                  <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
                </View>
              )}
              {call.videoEnabled && localStream && !call.sharingScreen ? (
                <RtcVideoView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror zOrder={1} />
              ) : null}
              {call.remoteScreen && call.peer?.id ? (
                <View style={styles.screenVolume}>
                  <ScreenVolumeControl userId={call.peer.id} />
                </View>
              ) : null}
              <Text style={styles.videoLabel}>
                {call.remoteScreen ? `${name} показывает экран` : call.sharingScreen ? 'Вы показываете экран' : `${name} · ${formatDuration(call.startedAt)}`}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
              </View>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.statusText}>
                {call.serverLost
                  ? 'Нет связи с сервером…'
                  : call.peerReconnecting
                    ? `${name} переподключается…`
                    : isIncoming ? 'Входящий звонок…' : call.status === 'outgoing' ? 'Вызов…' : formatDuration(call.startedAt)}
              </Text>
            </>
          )}

          <View style={styles.actions}>
            {isIncoming ? (
              <>
                <RoundButton color={L.danger} onPress={declineCall} icon={<PhoneOff size={22} color="#fff" />} label="Отклонить" />
                <RoundButton color={L.success} onPress={acceptCall} icon={<Phone size={22} color="#fff" />} label="Принять" />
              </>
            ) : (
              <>
                {isActive && (
                  <RoundButton
                    color={call.micMuted ? L.cardAlt : L.violet}
                    onPress={toggleMute}
                    icon={call.micMuted ? <MicOff size={22} color="#fff" /> : <Mic size={22} color="#fff" />}
                    label={call.micMuted ? 'Вкл. микрофон' : 'Микрофон'}
                  />
                )}
                {isActive && (
                  <RoundButton
                    color={call.videoEnabled ? L.accent : L.cardAlt}
                    onPress={() => void toggleVideo()}
                    icon={call.videoEnabled ? <Video size={22} color="#fff" /> : <VideoOff size={22} color="#fff" />}
                    label={call.videoEnabled ? 'Камера' : 'Видео'}
                  />
                )}
                {isActive && call.videoEnabled && !call.sharingScreen && (
                  <RoundButton
                    color={L.cardAlt}
                    onPress={switchCamera}
                    icon={<SwitchCamera size={22} color="#fff" />}
                    label="Сменить"
                  />
                )}
                {isActive && Platform.OS === 'android' && (
                  <RoundButton
                    color={call.sharingScreen ? L.accent : L.cardAlt}
                    onPress={() => void toggleScreenShare()}
                    icon={<MonitorUp size={22} color="#fff" />}
                    label={call.sharingScreen ? 'Стоп' : 'Экран'}
                  />
                )}
                <RoundButton
                  color={L.danger}
                  onPress={endCall}
                  icon={<PhoneOff size={22} color="#fff" />}
                  label={isActive ? 'Завершить' : 'Отменить'}
                />
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.borderStrong, padding: 28, alignItems: 'center' },
  cardVideo: { maxWidth: 420, padding: 12 },
  videoArea: { width: '100%', aspectRatio: 3 / 4, borderRadius: 0, overflow: 'hidden', backgroundColor: '#000' },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  avatarBig: { alignItems: 'center', justifyContent: 'center' },
  localVideo: { position: 'absolute', bottom: 10, right: 10, width: 96, height: 128, borderRadius: 0, backgroundColor: '#111' },
  screenVolume: { position: 'absolute', bottom: 10, right: 10 },
  videoLabel: { position: 'absolute', top: 10, left: 10, color: '#fff', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 0, overflow: 'hidden' },
  avatar: { width: 88, height: 88, borderRadius: 0, backgroundColor: L.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: L.text, fontSize: 34, fontFamily: 'Tiny5', },
  name: { color: L.text, fontSize: 20, fontFamily: 'Tiny5', marginTop: 16 },
  statusText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 24, justifyContent: 'center' },
  action: { alignItems: 'center', gap: 8 },
  round: { width: 60, height: 60, borderRadius: 0, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  toast: { position: 'absolute', top: 64, left: 20, right: 20, backgroundColor: L.card, borderWidth: 1, borderColor: L.borderStrong, borderRadius: 0, padding: 14 },
  toastText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center' },
}));
