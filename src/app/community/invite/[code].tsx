import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Check, ChevronLeft, Globe, Lock, TriangleAlert } from 'lucide-react-native';

import { joinByInvite, previewInvite, type InvitePreview } from '@/api/community';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

export default function CommunityInviteScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(() => !!code);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    let alive = true;
    previewInvite(code)
      .then((p) => {
        if (alive) setPreview(p);
      })
      .catch((e) => {
        if (alive) setError(apiError(e, 'Ссылка-приглашение недействительна'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [code]);

  const join = async () => {
    if (!code || joining) return;
    setJoining(true);
    setError('');
    try {
      const community = await joinByInvite(code);
      setJoined(true);
      setTimeout(() => router.replace(`/community/${community.ID}` as Href), 900);
    } catch (e) {
      setError(apiError(e, 'Не удалось присоединиться'));
      setJoining(false);
    }
  };

  const later = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/community' as Href);
  };

  const canGoBack = router.canGoBack();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {canGoBack ? (
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <ChevronLeft size={16} color={L.accent} />
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={L.accent} />
              <Text style={styles.loadingText}>Проверяем приглашение...</Text>
            </View>
          ) : !preview ? (
            <>
              <TriangleAlert size={40} color={L.danger} />
              <Text style={styles.invalidTitle}>Приглашение недействительно</Text>
              <Text style={styles.invalidText}>{error || 'Ссылка-приглашение недействительна'}</Text>
              <Pressable
                onPress={() => router.replace('/community' as Href)}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Вернуться в сообщества</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.label}>Вас пригласили в сообщество</Text>
              <Text style={styles.name}>{preview.name}</Text>

              <View style={styles.chips}>
                {preview.game_title ? (
                  <Text style={[styles.chip, styles.chipViolet]}>{preview.game_title}</Text>
                ) : null}
                {preview.theme_name ? (
                  <Text style={[styles.chip, styles.chipAccent]}>{preview.theme_name}</Text>
                ) : null}
                {preview.is_private ? (
                  <View style={[styles.chip, styles.chipRow]}>
                    <Lock size={10} color={L.violet} />
                    <Text style={styles.chipPrivateText}>Приватное</Text>
                  </View>
                ) : (
                  <View style={[styles.chip, styles.chipRow]}>
                    <Globe size={10} color={L.success} />
                    <Text style={styles.chipPublicText}>Публичное</Text>
                  </View>
                )}
              </View>

              {joined ? (
                <View style={styles.joined}>
                  <Check size={14} color={L.success} />
                  <Text style={styles.joinedText}>Вы вступили! Переходим...</Text>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void join()}
                    disabled={joining}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      styles.flex,
                      (joining || pressed) && styles.pressed,
                    ]}>
                    {joining ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryText}>Присоединиться</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={later}
                    style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}>
                    <Text style={styles.ghostText}>Позже</Text>
                  </Pressable>
                </View>
              )}

              {error && !joined ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: L.border,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: {
    color: L.accent,
    fontSize: 13, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.borderStrong,
    borderRadius: 0,
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  center: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  loadingText: {
    color: L.muted,
    fontSize: 11, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  invalidTitle: { color: L.text, fontSize: 18, fontFamily: 'Tiny5', textAlign: 'center' },
  invalidText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, textAlign: 'center' },

  label: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
  name: { color: L.text, fontSize: 26, fontFamily: 'Tiny5', textAlign: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    overflow: 'hidden',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  chipViolet: { backgroundColor: 'rgba(131,56,236,0.85)' },
  chipAccent: { backgroundColor: 'rgba(255,0,110,0.85)' },
  chipPrivateText: { color: L.violet, fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase' },
  chipPublicText: { color: L.success, fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase' },

  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 6 },
  primaryBtn: {
    backgroundColor: L.accent,
    borderRadius: 0,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryText: { color: '#fff', fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: { color: L.muted, fontSize: 13, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },

  joined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  joinedText: { color: L.success, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  error: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center' },
}));
