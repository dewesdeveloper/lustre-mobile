import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Meh, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react-native';

import { deleteReview, reviewRating, saveReview, type GameReview, type ReviewRating } from '@/api/reviews';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

const MAX_LEN = 4000; // как на сервере (maxReviewLen)

const OPTIONS: { id: ReviewRating; label: string; color: string; Icon: typeof ThumbsUp }[] = [
  { id: 'positive', label: 'Рекомендую', color: L.success, Icon: ThumbsUp },
  { id: 'neutral', label: 'Смешанные', color: L.neutral, Icon: Meh },
  { id: 'negative', label: 'Не рекомендую', color: L.danger, Icon: ThumbsDown },
];

/** Форма своего отзыва: оценка (как в лаунчере — три варианта) и текст. */
export default function ReviewComposer({
  gameId,
  mine,
  onChanged,
}: {
  gameId: number | string;
  /** Уже оставленный отзыв — форма заполняется им, отправка обновляет его */
  mine: GameReview | null;
  onChanged: () => void;
}) {
  const [rating, setRating] = useState<ReviewRating | null>(mine ? reviewRating(mine) : null);
  const [text, setText] = useState(mine?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!rating) {
      setError('Выберите оценку');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveReview(gameId, rating, text);
      onChanged();
    } catch (e) {
      setError(apiError(e, 'Не удалось отправить отзыв'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!mine) return;
    Alert.alert('Удалить отзыв?', 'Отзыв и оценка будут удалены.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteReview(mine.id);
            setRating(null);
            setText('');
            onChanged();
          } catch (e) {
            setError(apiError(e, 'Не удалось удалить отзыв'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{mine ? 'Ваш отзыв' : 'Оставить отзыв'}</Text>
      <View style={styles.options}>
        {OPTIONS.map(({ id, label, color, Icon }) => {
          const on = rating === id;
          return (
            <Pressable
              key={id}
              onPress={() => { setRating(id); setError(''); }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.option, on && { borderColor: color, backgroundColor: `${color}22` }]}>
              <Icon size={14} color={on ? color : L.muted} fill={on && id !== 'neutral' ? color : 'transparent'} />
              <Text style={[styles.optionText, on && { color }]} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Что понравилось, а что нет? (необязательно)"
        placeholderTextColor={L.muted}
        multiline
        maxLength={MAX_LEN}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        {mine ? (
          <Pressable onPress={remove} disabled={busy} style={styles.deleteBtn} hitSlop={6}>
            <Trash2 size={14} color={L.danger} />
            <Text style={styles.deleteText}>Удалить</Text>
          </Pressable>
        ) : <View />}
        <Pressable onPress={() => void submit()} disabled={busy} style={[styles.submit, busy && styles.disabled]}>
          {busy ? <ActivityIndicator size="small" color="#0b0210" /> : <Text style={styles.submitText}>{mine ? 'Обновить' : 'Отправить'}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  box: { borderWidth: 1, borderColor: L.border, backgroundColor: 'rgba(0,0,0,0.25)', padding: 12, marginBottom: 14, gap: 10 },
  title: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  options: { flexDirection: 'row', gap: 6 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: L.border, paddingVertical: 9, paddingHorizontal: 4 },
  optionText: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold' },
  input: {
    minHeight: 72, maxHeight: 160, backgroundColor: L.cardAlt, borderWidth: 1, borderColor: L.border,
    paddingHorizontal: 12, paddingVertical: 10, color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlignVertical: 'top',
  },
  error: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  deleteText: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
  submit: { backgroundColor: L.accent, paddingHorizontal: 18, height: 38, alignItems: 'center', justifyContent: 'center', minWidth: 120 },
  submitText: { color: '#0b0210', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  disabled: { opacity: 0.6 },
}));
