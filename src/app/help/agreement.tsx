import { themedStyles } from '@/theme/themedStyles';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { L } from '@/constants/lustre';

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function SubscriberAgreementDocScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Соглашение подписчика</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Соглашение <Text style={styles.heroAccent}>подписчика</Text>
          </Text>
          <Text style={styles.heroSub}>Условия подписки Lustre Pro</Text>
        </View>

        <View style={styles.doc}>
          <DocSection title="1. Предмет соглашения">
            <Text style={styles.paragraph}>
              Оформляя подписку Lustre Pro, вы получаете расширенный набор возможностей: уникальные темы, рамки,
              значки и приоритетную поддержку в рамках выбранного периода.
            </Text>
          </DocSection>

          <DocSection title="2. Оплата и продление">
            <Text style={styles.paragraph}>
              Стоимость и срок подписки отображаются при оформлении. Подписка продлевается вручную — автоматическое
              списание без вашего подтверждения не производится.
            </Text>
          </DocSection>

          <DocSection title="3. Возвраты">
            <Text style={styles.paragraph}>
              Возврат средств возможен в течение 14 дней, если подписка не была использована. По вопросам возврата
              обратитесь в службу поддержки.
            </Text>
          </DocSection>

          <DocSection title="4. Прекращение подписки">
            <Text style={styles.paragraph}>
              Вы можете отказаться от подписки в любой момент. Доступ к возможностям Pro сохраняется до конца
              оплаченного периода.
            </Text>
          </DocSection>

          <DocSection title="5. Изменение условий">
            <Text style={styles.paragraph}>
              Lustre вправе обновлять условия соглашения. Об существенных изменениях подписчики уведомляются заранее
              внутри лаунчера.
            </Text>
          </DocSection>
        </View>

        <Text style={styles.footer}>Lustre · Обновлено 10 сентября 2026 г.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  headerTitle: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  hero: { marginBottom: 4 },
  heroTitle: { color: L.text, fontSize: 28, fontFamily: 'Tiny5', letterSpacing: -0.5, textTransform: 'uppercase' },
  heroAccent: { color: L.accent },
  heroSub: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 8,
  },
  doc: {
    backgroundColor: '#09070c',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 20,
    gap: 24,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 10,
  },
  sectionBody: { gap: 10 },
  paragraph: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 20 },
  footer: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 8,
  },
}));
