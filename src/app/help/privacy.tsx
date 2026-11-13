import { themedStyles } from '@/theme/themedStyles';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';

import { L } from '@/constants/lustre';

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function PrivacyDocScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Политика конфиденциальности</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Политика <Text style={styles.heroAccent}>конфиденциальности</Text>
          </Text>
          <Text style={styles.heroSub}>Как Lustre собирает, использует и защищает ваши данные</Text>
        </View>

        <View style={styles.doc}>
          <DocSection title="1. Какие данные мы собираем">
            <Text style={styles.paragraph}>
              Мы обрабатываем данные аккаунта: логин, ник, email и настройки профиля. Также
              сохраняется техническая информация: идентификатор устройства, версия лаунчера, логи ошибок и
              статистика использования функций.
            </Text>
            <Text style={styles.paragraph}>
              Платёжные данные обрабатываются платёжными провайдерами — Lustre не хранит номера банковских карт.
            </Text>
          </DocSection>

          <DocSection title="2. Как мы используем данные">
            <Text style={styles.paragraph}>
              Данные нужны для входа в аккаунт, синхронизации библиотеки, работы друзей, чата, сообществ и системы
              достижений. Обезличенная статистика помогает находить ошибки и улучшать платформу.
            </Text>
          </DocSection>

          <DocSection title="3. Передача третьим лицам">
            <Text style={styles.paragraph}>
              Мы не продаём персональные данные. Передача возможна только сервисам, необходимым для работы
              лаунчера (хостинг, платежи, доставка файлов), и только в объёме, требуемом для оказания услуги.
            </Text>
          </DocSection>

          <DocSection title="4. Хранение и защита">
            <Text style={styles.paragraph}>
              Пароли хранятся только в виде криптографических хэшей. Доступ к инфраструктуре ограничен и защищён.
              Данные хранятся, пока существует аккаунт.
            </Text>
          </DocSection>

          <DocSection title="5. Ваши права">
            <Text style={styles.paragraph}>
              Вы можете запросить доступ, исправление или удаление своих данных, а также отписаться от рассылок. Для
              этого напишите в{' '}
              <Text style={styles.link} onPress={() => router.push('/support' as Href)}>
                службу поддержки
              </Text>
              .
            </Text>
          </DocSection>

          <DocSection title="6. Cookies и локальное хранилище">
            <Text style={styles.paragraph}>
              Лаунчер использует локальное хранилище для сессии и настроек. Файлы cookie не применяются для
              рекламного отслеживания.
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
  link: { color: L.accent, fontWeight: '700' },
  footer: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 8,
  },
}));
