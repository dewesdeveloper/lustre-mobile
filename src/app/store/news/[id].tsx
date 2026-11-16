import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { ArrowRight, Eye, Sparkles, Tag } from 'lucide-react-native';

import { getNewsById, viewNews, type NewsItem } from '@/api/news';
import { openExternalUrl } from '@/utils/openUrl';
import NewsGallery from '@/components/news/NewsGallery';
import { fmtNewsDate, newsCatMeta, newsImages } from '@/components/news/newsMeta';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

export default function NewsDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);

  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!Number.isFinite(id)) {
      setLoading(false);
      setError('Новость не найдена');
      return;
    }
    setLoading(true);
    setError('');
    getNewsById(id)
      .then((found) => {
        if (found) {
          setItem(found);
          // открытие засчитывает просмотр (один раз на пользователя)
          void viewNews(found.id).then((views) => {
            if (views !== null) setItem((cur) => (cur && cur.id === found.id ? { ...cur, views } : cur));
          });
        } else setError('Новость не найдена');
      })
      .catch((e) => setError(apiError(e, 'Не удалось загрузить новость')))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openLink = (link: string) => {
    const game = link.match(/\/games?\/(\d+)/);
    if (game) {
      router.push(`/game/${game[1]}` as Href);
      return;
    }
    openExternalUrl(link);
  };

  const canOpenLink = !!item?.link && (/^https?:\/\//.test(item.link) || /\/games?\/\d+/.test(item.link));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>

      {loading ? (
        <DataState loading onRetry={load} />
      ) : !item ? (
        <DataState error={error || 'Новость не найдена'} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <View
              style={[
                styles.chip,
                { backgroundColor: newsCatMeta(item.category).bg, borderColor: newsCatMeta(item.category).border },
              ]}>
              <Text style={[styles.chipText, { color: newsCatMeta(item.category).fg }]}>
                {newsCatMeta(item.category).label}
              </Text>
            </View>
            {item.for_you ? (
              <View style={[styles.chip, styles.chipForYou]}>
                <Sparkles size={9} color={L.accent} />
                <Text style={[styles.chipText, styles.chipForYouText]}>Для вас</Text>
              </View>
            ) : null}
            {item.views ? (
              <View style={styles.views}>
                <Eye size={11} color={L.muted} />
                <Text style={styles.viewsText}>{item.views.toLocaleString('ru-RU')}</Text>
              </View>
            ) : null}
            {item.created_at ? <Text style={styles.date}>{fmtNewsDate(item.created_at)}</Text> : null}
          </View>

          <Text style={styles.title}>{item.title}</Text>

          <NewsGallery images={newsImages(item.content, item.image_url)} />

          <Text style={styles.content2}>{item.content}</Text>

          {item.tags && item.tags.length > 0 ? (
            <View style={styles.tags}>
              <Tag size={12} color="rgba(244,244,246,0.25)" />
              {item.tags.map((t) => (
                <View key={t.id} style={styles.tag}>
                  <Text style={styles.tagText}>{t.name}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {canOpenLink ? (
            <Pressable
              onPress={() => openLink(item.link)}
              style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}>
              <Text style={styles.moreText}>Подробнее</Text>
              <ArrowRight size={14} color={L.text} />
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' },
  chipForYou: { backgroundColor: 'rgba(255,0,110,0.1)', borderColor: 'rgba(255,0,110,0.3)' },
  chipForYouText: { color: L.accent, marginLeft: 4 },
  chipText: { fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  views: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  date: {
    marginLeft: 'auto',
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  title: {
    color: L.text,
    fontSize: 24, fontFamily: 'Tiny5',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: -0.8,
    marginBottom: 16,
  },
  content2: { color: 'rgba(244,244,246,0.6)', fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 22 },

  tags: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 18 },
  tag: {
    backgroundColor: 'rgba(131,56,236,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(131,56,236,0.2)',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: { color: 'rgba(131,56,236,0.9)', fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },

  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  moreText: {
    color: 'rgba(244,244,246,0.7)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  pressed: { opacity: 0.7 },
}));
