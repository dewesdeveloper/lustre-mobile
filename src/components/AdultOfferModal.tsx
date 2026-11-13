import { Modal, Pressable, Text, View } from 'react-native';

import { answerAdultOffer, useAdultOfferPending } from '@/api/adultConsent';
import { L } from '@/constants/lustre';
import { themedStyles } from '@/theme/themedStyles';

/** Первый вход: игры 18+ скрыты, один раз предлагаем их показывать. */
export default function AdultOfferModal() {
  const pending = useAdultOfferPending();

  return (
    <Modal visible={pending} transparent animationType="fade" onRequestClose={() => answerAdultOffer(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>18+</Text>
          <Text style={styles.title}>Игры для взрослых</Text>
          <Text style={styles.text}>
            В каталоге есть игры с пометкой 18+. Сейчас они скрыты. Показывать их? Для этого подтвердите, что вам есть
            18 лет. Передумать можно в любой момент в магазине.
          </Text>
          <Pressable onPress={() => answerAdultOffer(true)} style={styles.primary}>
            <Text style={styles.primaryText}>Мне есть 18, показывать</Text>
          </Pressable>
          <Pressable onPress={() => answerAdultOffer(false)} style={styles.secondary}>
            <Text style={styles.secondaryText}>Не показывать</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: L.cardAlt, borderWidth: 1, borderColor: L.borderStrong, padding: 18, gap: 10 },
  badge: { color: L.accent, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold' },
  title: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold' },
  text: { color: 'rgba(226,226,226,0.8)', fontSize: 12, lineHeight: 18, fontFamily: 'JetBrainsMono_400Regular', marginBottom: 6 },
  primary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: L.accent, paddingHorizontal: 12 },
  primaryText: { color: '#0b0210', fontSize: 12, fontFamily: 'JetBrainsMono_700Bold' },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: L.border, paddingHorizontal: 12 },
  secondaryText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold' },
}));
