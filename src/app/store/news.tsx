import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';

import { getNews, type NewsItem } from '@/api/news';
import NewsCard from '@/components/news/NewsCard';
import { NEWS_CATEGORIES, fmtNewsDate, newsCatMeta, newsExcerpt } from '@/components/news/newsMeta';
import DataState from '@/components/ui/DataState';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

export default function NewsScreen() {
  const [category, setCategory] = useState('all');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getNews(category)
      .then((items) => setNews(items))
      .catch((e) => {
        setNews([]);
        setError(apiError(e, 'Не удалось загрузить новости'));
      })
      .finally(() => setLoading(false));
  }, [category]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = (item: NewsItem) => router.push(`/store/news/${item.id}` as Href);
  const [banner, ...rest] = news;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Pressable onPress={load} style={styles.refresh} hitSlop={8}>
          <RefreshCw size={16} color={L.muted} />
        </Pressable>
      </View>

      <View style={styles.head}>
        <Text style={styles.title}>
          Новости <Text style={styles.titleAccent}>Lustre</Text>
        </Text>
        <Text style={styles.subtitle}>
          Персональная лента: обновления, игры, оформление и подписки
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
        style={styles.catScroll}>
        {NEWS_CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              style={({ pressed }) => [styles.cat, active && styles.catActive, pressed && styles.pressed]}>
              <Text style={[styles.catText, active && styles.catTextActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading || error ? (
        <DataState loading={loading} error={error} onRetry={load} />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            banner ? (
              <Pressable
                onPress={() => open(banner)}
                style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
                <View style={styles.chipRow}>
                  <View
                    style={[
                      styles.chip,
                      { backgroundColor: newsCatMeta(banner.category).bg, borderColor: newsCatMeta(banner.category).border },
                    ]}>
                    <Text style={[styles.chipText, { color: newsCatMeta(banner.category).fg }]}>
                      {newsCatMeta(banner.category).label}
                    </Text>
                  </View>
                  {banner.created_at ? <Text style={styles.bannerDate}>{fmtNewsDate(banner.created_at)}</Text> : null}
                </View>

                {banner.image_url ? <Image source={{ uri: banner.image_url }} style={styles.bannerImage} /> : null}
                <Text style={styles.bannerTitle} numberOfLines={2}>{banner.title}</Text>
                {banner.content ? (
                  <Text style={styles.bannerExcerpt} numberOfLines={3}>{newsExcerpt(banner.content)}</Text>
                ) : null}
              </Pressable>
            ) : null
          }
          ListEmptyComponent={<DataState empty emptyText="Новостей пока нет" />}
          renderItem={({ item }) => <NewsCard item={item} onPress={() => open(item)} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { paddingHorizontal: 16, paddingBottom: 4 },
  title: { color: L.text, fontSize: 28, fontFamily: 'Tiny5', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: -1 },
  titleAccent: { color: L.accent },
  subtitle: {
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginTop: 6,
  },

  catScroll: { flexGrow: 0 },
  catRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  cat: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  catActive: { backgroundColor: L.accent, borderColor: L.accent },
  catText: { color: 'rgba(244,244,246,0.4)', fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1.5 },
  catTextActive: { color: '#fff' },
  pressed: { opacity: 0.75 },

  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },

  banner: {
    backgroundColor: '#09070c',
    borderWidth: 1,
    borderColor: 'rgba(255,0,110,0.18)',
    borderRadius: 0,
    padding: 16,
    marginBottom: 12,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 10, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  bannerDate: {
    marginLeft: 'auto',
    color: 'rgba(244,244,246,0.6)',
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bannerImage: {
    width: '100%',
    height: 190,
    borderRadius: 0,
    backgroundColor: '#000',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  bannerTitle: { color: L.text, fontSize: 19, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: -0.5 },
  bannerExcerpt: { color: 'rgba(244,244,246,0.45)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginTop: 8 },
}));
