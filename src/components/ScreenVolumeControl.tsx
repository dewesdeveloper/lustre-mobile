import { themedStyles } from '@/theme/themedStyles';
import { useRef, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Minus, Plus, Volume2, VolumeX } from 'lucide-react-native';

import { getScreenVolume, hasScreenAudio, setScreenVolume, subscribeScreenAudio } from '@/api/livekitRoom';
import { L } from '@/constants/lustre';

const STEP = 0.1;

/**
 * Громкость звука демонстрации экрана конкретного участника (как в лаунчере).
 * Меняет только звук трансляции — голос участника остаётся прежним. Показывается,
 * пока у участника есть звук демонстрации.
 */
export default function ScreenVolumeControl({ userId, compact = false }: { userId: number; compact?: boolean }) {
  const snap = useSyncExternalStore(subscribeScreenAudio, () =>
    hasScreenAudio(userId) ? Math.round(getScreenVolume(userId) * 100) : -1,
  );
  const beforeMute = useRef(1);
  if (snap < 0) return null;

  const volume = snap / 100;
  const muted = volume === 0;
  const change = (delta: number) => setScreenVolume(userId, Math.round((volume + delta) * 10) / 10);
  const toggleMute = () => {
    if (muted) setScreenVolume(userId, beforeMute.current || 1);
    else {
      beforeMute.current = volume;
      setScreenVolume(userId, 0);
    }
  };

  return (
    <View style={[styles.box, compact && styles.compact]} accessibilityLabel="Громкость демонстрации экрана">
      <Pressable onPress={toggleMute} hitSlop={6} accessibilityLabel={muted ? 'Включить звук трансляции' : 'Выключить звук трансляции'} style={styles.btn}>
        {muted ? <VolumeX size={compact ? 13 : 15} color={L.danger} /> : <Volume2 size={compact ? 13 : 15} color="#fff" />}
      </Pressable>
      <Pressable onPress={() => change(-STEP)} disabled={volume <= 0} hitSlop={6} accessibilityLabel="Тише" style={[styles.btn, volume <= 0 && styles.off]}>
        <Minus size={compact ? 12 : 14} color="#fff" />
      </Pressable>
      <Text style={[styles.value, compact && styles.valueCompact]}>{snap}%</Text>
      <Pressable onPress={() => change(STEP)} disabled={volume >= 1} hitSlop={6} accessibilityLabel="Громче" style={[styles.btn, volume >= 1 && styles.off]}>
        <Plus size={compact ? 12 : 14} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = themedStyles(() => ({
  box: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 4 },
  compact: { paddingHorizontal: 3, paddingVertical: 2, gap: 2 },
  btn: { padding: 4 },
  off: { opacity: 0.35 },
  value: { color: '#fff', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', minWidth: 40, textAlign: 'center' },
  valueCompact: { fontSize: 10, minWidth: 32 },
}));
