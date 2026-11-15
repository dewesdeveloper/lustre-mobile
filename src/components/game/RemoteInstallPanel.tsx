import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CheckCircle2, ChevronDown, ChevronUp, Monitor, Send, XCircle } from 'lucide-react-native';

import api from '@/api/client';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';
import { themedStyles } from '@/theme/themedStyles';

// Удалённая установка: выбрать свой компьютер с лаунчером Lustre и поставить игру на загрузку.
// Компьютер не в сети — команда выполнится, когда на нём запустят лаунчер.

type Device = { device_id: string; name: string; platform: string; online: boolean; last_seen_at: string };
type Install = { id: number; device_id: string; status: string; error: string };
type Source = { kind: string; label: string; size: string };

const KIND_LABEL: Record<string, string> = {
  torrent: 'Торрент', itch: 'itch.io', direct: 'Прямая ссылка', mega: 'MEGA', pixeldrain: 'Pixeldrain',
  mediafire: 'MediaFire', gofile: 'Gofile', mixdrop: 'Mixdrop', gdrive: 'Google Drive', yadisk: 'Яндекс Диск',
};

const STATUS_TEXT: Record<string, string> = {
  pending: 'Ждёт запуска лаунчера на компьютере',
  delivered: 'Команда получена, запускаем загрузку…',
  started: 'Загрузка началась',
  failed: 'Не удалось начать загрузку',
};

function lastSeen(iso: string): string {
  const d = new Date(iso).getTime();
  if (!d) return '';
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 60) return `был в сети ${Math.max(min, 1)} мин назад`;
  const h = Math.round(min / 60);
  if (h < 48) return `был в сети ${h} ч назад`;
  return `был в сети ${Math.round(h / 24)} дн назад`;
}

export default function RemoteInstallPanel({ gameId, sources, hasMagnet, onAddedToLibrary, children }: {
  gameId: number;
  /** сервер добавил игру в библиотеку вместе с отправкой на ПК */
  onAddedToLibrary?: () => void;
  sources: Source[];
  hasMagnet: boolean;
  /** Запасной вариант (QR-код) — свёрнут, если есть компьютеры */
  children: ReactNode;
}) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [sourceIndex, setSourceIndex] = useState(sources.length ? 0 : -1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [install, setInstall] = useState<Install | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let alive = true;
    api.get('/remote/devices')
      .then(({ data }) => {
        if (!alive) return;
        const list: Device[] = data?.devices || [];
        setDevices(list);
        setDeviceId((list.find((d) => d.online) || list[0])?.device_id || '');
      })
      .catch(() => alive && setDevices([]));
    return () => { alive = false; };
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);
  useEffect(() => stopPoll, [stopPoll]);

  // статус команды: опрашиваем, пока загрузка не началась или не упала (не дольше 2 минут)
  const watch = useCallback((id: number) => {
    stopPoll();
    const until = Date.now() + 120000;
    pollRef.current = setInterval(() => {
      if (Date.now() > until) { stopPoll(); return; }
      api.get('/remote/installs', { params: { game_id: gameId } })
        .then(({ data }) => {
          const it: Install | undefined = (data?.installs || []).find((x: Install) => x.id === id);
          if (!it) return;
          setInstall(it);
          if (it.status === 'started' || it.status === 'failed') stopPoll();
        })
        .catch(() => {});
    }, 2500);
  }, [gameId, stopPoll]);

  const send = async () => {
    if (!deviceId || sending) return;
    setSending(true);
    setError('');
    try {
      const { data } = await api.post('/remote/installs', { device_id: deviceId, game_id: gameId, source_index: sourceIndex });
      setInstall(data.install);
      if (data.in_library) onAddedToLibrary?.();
      watch(data.install.id);
    } catch (e) {
      setError(apiError(e, 'Не удалось отправить на компьютер'));
    } finally {
      setSending(false);
    }
  };

  if (devices === null) {
    return <ActivityIndicator color={L.accent} style={{ marginTop: 20 }} />;
  }

  const qr = (
    <>
      {devices.length > 0 ? (
        <Pressable style={styles.qrToggle} onPress={() => setQrOpen((v) => !v)}>
          <Text style={styles.qrToggleText}>Открыть по QR-коду</Text>
          {qrOpen ? <ChevronUp size={14} color={L.muted} /> : <ChevronDown size={14} color={L.muted} />}
        </Pressable>
      ) : null}
      {devices.length === 0 || qrOpen ? children : null}
    </>
  );

  if (devices.length === 0) {
    return (
      <>
        <Text style={styles.empty}>
          Компьютеров пока нет. Войдите в этот аккаунт в лаунчере Lustre на ПК — и сможете ставить игры на загрузку прямо отсюда.
        </Text>
        {qr}
      </>
    );
  }

  const canSourcePick = sources.length > 1;
  const done = install && (install.status === 'started' || install.status === 'failed');

  return (
    <View style={{ alignSelf: 'stretch' }}>
      <Text style={styles.label}>Компьютер</Text>
      {devices.map((d) => {
        const active = d.device_id === deviceId;
        return (
          <Pressable key={d.device_id} style={[styles.row, active && styles.rowActive]} onPress={() => setDeviceId(d.device_id)}>
            <Monitor size={16} color={active ? L.accent : L.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{d.name}</Text>
              <Text style={[styles.rowSub, d.online && { color: L.success }]} numberOfLines={1}>
                {d.online ? 'в сети' : lastSeen(d.last_seen_at)}
              </Text>
            </View>
            <View style={[styles.dot, { backgroundColor: d.online ? L.success : L.border }]} />
          </Pressable>
        );
      })}

      {canSourcePick ? (
        <>
          <Text style={[styles.label, { marginTop: 14 }]}>Источник</Text>
          {sources.map((s, i) => {
            const active = i === sourceIndex;
            return (
              <Pressable key={i} style={[styles.row, active && styles.rowActive]} onPress={() => setSourceIndex(i)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{s.label || KIND_LABEL[s.kind] || s.kind}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{[KIND_LABEL[s.kind] || s.kind, s.size].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}

      {!sources.length && !hasMagnet ? (
        <Text style={styles.error}>У игры пока нет источника для скачивания</Text>
      ) : (
        <Pressable style={[styles.sendBtn, (sending || !deviceId) && { opacity: 0.6 }]} disabled={sending || !deviceId} onPress={() => void send()}>
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={15} color="#fff" />}
          <Text style={styles.sendText}>{install && !done ? 'Отправлено' : 'Скачать на компьютере'}</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {install ? (
        <View style={styles.status}>
          {install.status === 'started' ? <CheckCircle2 size={15} color={L.success} />
            : install.status === 'failed' ? <XCircle size={15} color={L.danger} />
            : <ActivityIndicator size="small" color={L.accent} />}
          <Text style={[styles.statusText, install.status === 'failed' && { color: L.danger }]}>
            {STATUS_TEXT[install.status] || install.status}
            {install.status === 'failed' && install.error ? `: ${install.error}` : ''}
          </Text>
        </View>
      ) : null}

      <View style={{ alignItems: 'center' }}>{qr}</View>
    </View>
  );
}

const styles = themedStyles(() => ({
  label: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: L.border, marginBottom: 6 },
  rowActive: { borderColor: L.accent, backgroundColor: L.cardAlt },
  rowTitle: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold' },
  rowSub: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, paddingVertical: 12, backgroundColor: L.accent },
  sendText: { color: '#fff', fontSize: 13, fontFamily: 'JetBrainsMono_700Bold' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  statusText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', flex: 1, lineHeight: 17 },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 10 },
  empty: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', marginTop: 14, lineHeight: 18 },
  qrToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, padding: 4 },
  qrToggleText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
}));
