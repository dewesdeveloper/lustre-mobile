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

export default function LegalInfoDocScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Правовая информация</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Правовая <Text style={styles.heroAccent}>информация</Text>
          </Text>
          <Text style={styles.heroSub}>Реквизиты, права и отказ от ответственности</Text>
        </View>

        <View style={styles.doc}>
          <DocSection title="1. Правообладатель">
            <Text style={styles.paragraph}>
              Платформа Lustre и лаунчер являются собственностью команды Lustre. Все игровые материалы, логотипы и
              торговые марки принадлежат их правообладателям.
            </Text>
          </DocSection>

          <DocSection title="2. Использование сервиса">
            <Text style={styles.paragraph}>
              Сервис предоставляется «как есть». Запрещено использование лаунчера для распространения вредоносного
              ПО, нарушения авторских прав и любой противоправной деятельности.
            </Text>
          </DocSection>

          <DocSection title="3. Интеллектуальная собственность">
            <Text style={styles.paragraph}>
              Пользовательский контент (обсуждения, изображения, скриншоты) остаётся за автором. Публикуя контент,
              вы предоставляете Lustre право на его отображение внутри платформы.
            </Text>
          </DocSection>

          <DocSection title="4. Отказ от ответственности">
            <Text style={styles.paragraph}>
              Lustre не несёт ответственности за перерывы в работе, действия третьих лиц или возможный ущерб,
              связанный с использованием неофициального программного обеспечения.
            </Text>
          </DocSection>

          <DocSection title="5. Претензии и DMCA">
            <Text style={styles.paragraph}>
              По вопросам нарушения авторских прав или использования ваших материалов направьте обращение в службу
              поддержки с указанием ссылок и подтверждающих документов.
            </Text>
          </DocSection>

          <DocSection title="6. Шрифты">
            <Text style={styles.paragraph}>
              В приложении используются шрифты Tiny5 (© 2022–2024 The Tiny5 Project Authors) и JetBrains Mono
              (© 2020 The JetBrains Mono Project Authors). Оба распространяются по лицензии SIL Open Font License 1.1
              (openfontlicense.org); уведомления об авторских правах и текст лицензии также содержатся в метаданных
              файлов шрифтов.
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
