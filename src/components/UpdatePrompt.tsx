import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Download, RefreshCw } from 'lucide-react-native';

import { checkForUpdate, currentVersion, downloadAndInstall, snoozeUpdate, type AndroidRelease } from '@/api/appUpdate';
import { L } from '@/constants/lustre';
import { themedStyles } from '@/theme/themedStyles';
import { openExternalUrl } from '@/utils/openUrl';

type State = { phase: 'idle' } | { phase: 'loading'; progress: number } | { phase: 'error'; message: string };

// Окно «Доступно обновление»: при запуске (через пару секунд, чтобы не мешать старту)
// и по событию из настроек «Проверить обновления».
let openManual: ((rel: AndroidRelease) => void) | null = null;

/** Показать окно обновления (из настроек), если найдена новая сборка */
export function showUpdatePrompt(rel: AndroidRelease) {
  openManual?.(rel);
}

export default function UpdatePrompt() {
  const [rel, setRel] = useState<AndroidRelease | null>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });

  useEffect(() => {
    openManual = (r) => { setState({ phase: 'idle' }); setRel(r); };
    if (__DEV__) return () => { openManual = null; };
    const timer = setTimeout(() => {
      checkForUpdate().then((r) => r && setRel(r)).catch(() => { /* нет сети — проверим при следующем запуске */ });
    }, 3000);
    return () => { clearTimeout(timer); openManual = null; };
  }, []);

  if (!rel) return null;

  const later = () => {
    void snoozeUpdate(rel.version_code);
    setRel(null);
  };

  const update = async () => {
    setState({ phase: 'loading', progress: 0 });
    try {
      await downloadAndInstall(rel, (progress) => setState({ phase: 'loading', progress }));
      setState({ phase: 'idle' });
    } catch (e) {
      setState({ phase: 'error', message: e instanceof Error ? e.message : 'Не удалось скачать обновление' });
    }
  };

  const loading = state.phase === 'loading';
  const pct = loading ? Math.round(state.progress * 100) : 0;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={loading ? () => {} : later} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconBox}><RefreshCw size={22} color={L.accent} /></View>
          <Text style={styles.title}>Доступно обновление</Text>
          <Text style={styles.sub}>
            {rel.version ? `Версия ${rel.version}` : `Сборка ${rel.version_code}`}
            {currentVersion() ? ` · у вас ${currentVersion()}` : ''}
          </Text>

          {rel.notes ? (
            <ScrollView style={styles.notes} contentContainerStyle={{ padding: 12 }}>
              <Text style={styles.notesText}>{rel.notes}</Text>
            </ScrollView>
          ) : null}

          {loading ? (
            <View style={{ alignSelf: 'stretch', marginTop: 18 }}>
              <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
              <Text style={styles.progressText}>{pct > 0 ? `Скачиваем… ${pct}%` : 'Скачиваем…'}</Text>
            </View>
          ) : (
            <>
              {state.phase === 'error' ? (
                <Text style={styles.error}>Не получилось: {state.message}. Можно скачать в браузере.</Text>
              ) : null}
              <Pressable style={styles.primary} onPress={() => void update()}>
                <Download size={16} color="#fff" />
                <Text style={styles.primaryText}>{state.phase === 'error' ? 'Попробовать снова' : 'Обновить'}</Text>
              </Pressable>
              {state.phase === 'error' ? (
                <Pressable style={styles.secondary} onPress={() => openExternalUrl(rel.fallback_url || rel.url)}>
                  <Text style={styles.secondaryText}>Скачать в браузере</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.secondary} onPress={later}>
                <Text style={styles.secondaryText}>Позже</Text>
              </Pressable>
            </>
          )}
          {loading && pct === 100 ? <ActivityIndicator color={L.accent} style={{ marginTop: 8 }} /> : null}
          <Text style={styles.hint}>
            После скачивания откроется установщик Android. Если он попросит разрешение «Устанавливать из этого источника» — разрешите для Lustre.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: L.card, borderWidth: 1, borderColor: L.borderStrong, padding: 22, alignItems: 'center' },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.border, marginBottom: 12 },
  title: { color: L.text, fontSize: 15, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' },
  sub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 6, textAlign: 'center' },
  notes: { alignSelf: 'stretch', maxHeight: 180, marginTop: 14, borderWidth: 1, borderColor: L.border },
  notesText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },
  track: { height: 6, backgroundColor: L.cardAlt, borderWidth: 1, borderColor: L.border },
  fill: { height: '100%', backgroundColor: L.accent },
  progressText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 8, textAlign: 'center' },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 14, textAlign: 'center' },
  primary: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, paddingVertical: 12, backgroundColor: L.accent },
  primaryText: { color: '#fff', fontSize: 13, fontFamily: 'JetBrainsMono_700Bold' },
  secondary: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 11, marginTop: 8, borderWidth: 1, borderColor: L.border },
  secondaryText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold' },
  hint: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', marginTop: 14, textAlign: 'center', lineHeight: 15 },
}));
