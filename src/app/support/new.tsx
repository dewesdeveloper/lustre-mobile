import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import {
  Check,
  ChevronDown,
  FileText,
  MessageCircleQuestion,
  X,
} from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { createTicket, uploadSupportAttachment } from '@/api/support';
import { TOPICS } from '@/components/support/meta';
import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

type Attachment = { uri: string; name: string; mimeType?: string };

export default function TicketFormScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { user } = useAuth();

  const initial = TOPICS.find((t) => t.category === category) || TOPICS[0];
  const [topic, setTopic] = useState(initial.label);
  const [topicOpen, setTopicOpen] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [attach, setAttach] = useState<Attachment | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentSubject, setSentSubject] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [ticketId, setTicketId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const pickDocument = async () => {
    setError('');
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setAttach({ uri: a.uri, name: a.name, mimeType: a.mimeType });
    } catch {
      setError('Не удалось выбрать файл');
    }
  };

  const submit = async () => {
    setError('');
    if (!email.trim()) {
      setError('Укажите email для ответа');
      return;
    }
    if (message.trim().length < 10) {
      setError('Опишите проблему подробнее (минимум 10 символов)');
      return;
    }
    setSending(true);
    try {
      let text = message.trim();
      if (attach && user) {
        try {
          const up = await uploadSupportAttachment(attach, user.id);
          text += `\n\nВложение: ${up.url || attach.name}`;
        } catch {
          setError('Не удалось загрузить вложение');
          setSending(false);
          return;
        }
      }
      const cat = TOPICS.find((t) => t.label === topic)?.category || 'other';
      const t = await createTicket({
        subject: topic,
        email: email.trim(),
        category: cat,
        message: text,
      });
      setTicketId(t.id);
      setSentSubject(topic);
      setSentEmail(email.trim());
      setSent(true);
      setMessage('');
      setAttach(null);
    } catch (e) {
      setError(apiError(e, 'Не удалось отправить обращение'));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSent(false);
    setTicketId(null);
    setError('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Новое обращение</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {sent ? (
          <View style={styles.sentBox}>
            <View style={styles.sentIcon}>
              <Check size={28} color={L.success} />
            </View>
            <Text style={styles.sentTitle}>Обращение отправлено</Text>
            <Text style={styles.sentText}>
              Мы получили ваше сообщение по теме «{sentSubject}» и ответим на {sentEmail} в течение 24 часов.
            </Text>
            {ticketId !== null ? (
              <Button title="Открыть обращение" onPress={() => router.replace(`/support/ticket/${ticketId}` as Href)} />
            ) : null}
            <Button title="Создать ещё обращение" onPress={reset} variant="ghost" />
          </View>
        ) : (
          <>
            <View style={styles.formHead}>
              <MessageCircleQuestion size={16} color={L.accent} />
              <Text style={styles.formHeadText}>Написать в поддержку</Text>
            </View>

            <Label>Тема обращения</Label>
            <Pressable onPress={() => setTopicOpen(true)} style={styles.select}>
              <Text style={styles.selectText} numberOfLines={1}>
                {topic}
              </Text>
              <ChevronDown size={16} color={L.muted} />
            </Pressable>

            <Label>Email для ответа *</Label>
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />

            <Label>Описание проблемы *</Label>
            <Input
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={2000}
              placeholder="Опишите, что произошло, и приложите шаги для воспроизведения..."
              style={styles.textarea}
            />
            <Text style={styles.counter}>
              {message.length} / 2000
            </Text>

            <Label>Вложение</Label>
            {attach ? (
              <View style={styles.attachRow}>
                <FileText size={16} color={L.violet} />
                <Text style={styles.attachName} numberOfLines={1}>
                  {attach.name}
                </Text>
                <Pressable onPress={() => setAttach(null)} hitSlop={8}>
                  <X size={16} color={L.muted} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => void pickDocument()} style={styles.attachPick}>
                <FileText size={16} color={L.muted} />
                <Text style={styles.attachPickText}>Приложить файл</Text>
              </Pressable>
            )}

            <ErrorText>{error}</ErrorText>

            <Button
              title={sending ? 'Отправляем...' : 'Отправить обращение'}
              onPress={() => void submit()}
              loading={sending}
            />
          </>
        )}
      </ScrollView>

      {/* Выбор темы */}
      <Modal visible={topicOpen} transparent animationType="fade" onRequestClose={() => setTopicOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setTopicOpen(false)}>
          <View style={styles.topicModal}>
            <Text style={styles.topicModalTitle}>Тема обращения</Text>
            {TOPICS.map((t) => {
              const active = t.label === topic;
              return (
                <Pressable
                  key={t.label}
                  onPress={() => {
                    setTopic(t.label);
                    setTopicOpen(false);
                  }}
                  style={[styles.topicItem, active && styles.topicItemActive]}>
                  <Text style={[styles.topicItemText, active && styles.topicItemTextActive]} numberOfLines={2}>
                    {t.label}
                  </Text>
                  {active ? <Check size={14} color={L.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 20, paddingBottom: 48 },
  formHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    marginTop: 4,
  },
  formHeadText: {
    color: L.muted,
    fontSize: 11, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectText: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_400Regular', flex: 1 },
  textarea: { minHeight: 140 },
  counter: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'right', marginTop: 4 },
  attachPick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: L.border,
    borderStyle: 'dashed',
    borderRadius: 0,
    paddingVertical: 14,
  },
  attachPickText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: L.cardAlt,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  attachName: { flex: 1, color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  sentBox: { alignItems: 'center', paddingTop: 24 },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.5)',
    backgroundColor: 'rgba(52,211,153,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  sentTitle: { color: L.text, fontSize: 15, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  sentText: {
    color: L.muted,
    fontSize: 13, fontFamily: 'JetBrainsMono_400Regular',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  topicModal: {
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 12,
  },
  topicModalTitle: {
    color: L.muted,
    fontSize: 11, fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 0,
  },
  topicItemActive: { backgroundColor: 'rgba(255,0,110,0.1)' },
  topicItemText: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', flex: 1 },
  topicItemTextActive: { color: L.text },
}));
