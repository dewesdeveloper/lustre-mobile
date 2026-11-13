import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  LifeBuoy,
  Search,
  X,
} from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, type Href } from 'expo-router';

import { getMyTickets, type SupportTicket } from '@/api/support';
import { Avatar } from '@/components/settings/ui';
import { FAQ, STATUS_META } from '@/components/support/meta';
import DataState from '@/components/ui/DataState';
import { Button } from '@/components/ui/form';
import { L } from '@/constants/lustre';


function StatusChip({ status }: { status: SupportTicket['status'] }) {
  const m = STATUS_META[status] || STATUS_META.open;
  return (
    <View style={[styles.chip, { backgroundColor: m.bg, borderColor: m.border }]}>
      <Text style={[styles.chipText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

export default function SupportHubScreen() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getMyTickets()
        .then((t) => alive && setTickets(t))
        .catch((e) => alive && setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Не удалось загрузить обращения'))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, []),
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? tickets.filter((t) =>
        (t.subject + ' ' + (t.messages?.[t.messages.length - 1]?.content || '')).toLowerCase().includes(q),
      )
    : tickets;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Поддержка</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <LifeBuoy size={22} color={L.accent} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>Служба поддержки</Text>
            <Text style={styles.heroSub}>Отвечаем в среднем в течение 24 часов</Text>
          </View>
        </View>

        <Button title="Создать обращение" onPress={() => router.push('/support/new' as Href)} />

        {/* Частые вопросы */}
        <Text style={styles.sectionLabel}>Частые вопросы</Text>
        <View style={styles.card}>
          {FAQ.map((cat, i) => {
            const open = faqOpen === i;
            return (
              <View key={cat.category} style={i === FAQ.length - 1 ? styles.rowLast : undefined}>
                <Pressable
                  onPress={() => setFaqOpen(open ? null : i)}
                  style={[styles.faqCat, i === FAQ.length - 1 && styles.rowLast]}>
                  <Text style={styles.faqCatText}>{cat.category}</Text>
                  <ChevronDown
                    size={16}
                    color={L.muted}
                    style={[styles.faqArrow, open && styles.faqArrowOpen]}
                  />
                </Pressable>
                {open
                  ? cat.items.map((item) => (
                      <View key={item.q} style={styles.faqItem}>
                        <Text style={styles.faqQ}>{item.q}</Text>
                        <Text style={styles.faqA}>{item.a}</Text>
                      </View>
                    ))
                  : null}
              </View>
            );
          })}
        </View>

        {/* Мои обращения */}
        <View style={styles.listHead}>
          <Text style={styles.sectionLabel}>Мои обращения</Text>
          <Text style={styles.listCount}>{tickets.length}</Text>
        </View>

        <View style={styles.searchWrap}>
          <Search size={16} color={L.muted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск по теме или тексту обращения..."
            placeholderTextColor={L.muted}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={L.muted} />
            </Pressable>
          ) : null}
        </View>

        <DataState
          loading={loading}
          error={error}
          empty={!loading && !error && filtered.length === 0}
          emptyText={query ? 'Ничего не найдено' : 'У вас пока нет обращений'}
          onRetry={() => {
            setLoading(true);
            setError('');
            getMyTickets()
              .then(setTickets)
              .catch(() => setError('Не удалось загрузить обращения'))
              .finally(() => setLoading(false));
          }}
        />

        {!loading &&
          filtered.map((t) => {
            const last = t.messages?.[t.messages.length - 1];
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/support/ticket/${t.id}` as Href)}
                style={({ pressed }) => [styles.ticketRow, pressed && styles.ticketPressed]}>
                <Avatar url={last?.author?.profile?.avatar_url} name={last?.author?.username || 'S'} size={36} />
                <View style={styles.ticketBody}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>
                    {t.subject}
                  </Text>
                  <Text style={styles.ticketPreview} numberOfLines={1}>
                    {last?.content || 'Нет сообщений'}
                  </Text>
                </View>
                <View style={styles.ticketMeta}>
                  <StatusChip status={t.status} />
                  {last?.is_staff ? <Text style={styles.staffReply}>Есть ответ</Text> : null}
                  <Text style={styles.ticketDate}>
                    {new Date(t.created_at).toLocaleDateString('ru-RU')}
                  </Text>
                </View>
                <ChevronRight size={16} color={L.muted} />
              </Pressable>
            );
          })}

        <Pressable
          onPress={() => router.push('/help/about' as Href)}
          style={styles.docRow}
          hitSlop={6}>
          <Text style={styles.docRowText}>О платформе, правила и документы</Text>
          <ChevronRight size={16} color={L.muted} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 16,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    backgroundColor: 'rgba(255,0,110,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: { flex: 1, minWidth: 0 },
  heroTitle: { color: L.text, fontSize: 15, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  heroSub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  sectionLabel: {
    color: L.muted,
    fontSize: 11, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  card: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    paddingHorizontal: 16,
  },
  rowLast: { borderBottomWidth: 0 },
  faqCat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: L.border,
  },
  faqCatText: { flex: 1, color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  faqArrow: { transform: [{ rotate: '0deg' }] },
  faqArrowOpen: { transform: [{ rotate: '180deg' }] },
  faqItem: { paddingBottom: 14 },
  faqQ: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', marginBottom: 4 },
  faqA: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listCount: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', marginTop: 8 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', paddingVertical: 12 },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 12,
  },
  ticketPressed: { opacity: 0.7 },
  ticketBody: { flex: 1, minWidth: 0 },
  ticketSubject: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
  ticketPreview: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  ticketMeta: { alignItems: 'flex-end', gap: 4 },
  chip: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', },
  staffReply: { color: L.success, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', },
  ticketDate: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_400Regular' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 14,
    marginTop: 8,
  },
  docRowText: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', },
}));
