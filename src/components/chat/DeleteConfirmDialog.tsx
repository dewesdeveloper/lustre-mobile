import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { L } from '@/constants/lustre';

interface DeleteConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Показывать чекбокс «Удалить у всех» */
  showForAll?: boolean;
  defaultForAll?: boolean;
  onConfirm: (forAll: boolean) => void;
  onClose: () => void;
}

/** Подтверждение удаления с чекбоксом «Удалить у всех». */
export const DeleteConfirmDialog = ({
  visible, title, message, showForAll = true, defaultForAll = true, onConfirm, onClose,
}: DeleteConfirmDialogProps) => {
  const [forAll, setForAll] = useState(defaultForAll && showForAll);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {showForAll ? (
            <Pressable style={styles.cbRow} onPress={() => setForAll((v) => !v)}>
              <View style={[styles.checkbox, forAll && styles.checkboxOn]}>
                {forAll ? <Check size={11} color="#000" /> : null}
              </View>
              <Text style={styles.cbLabel}>Удалить у всех</Text>
            </Pressable>
          ) : null}

          <View style={styles.btnRow}>
            <Pressable onPress={onClose} style={styles.btnGhost}>
              <Text style={styles.btnGhostText}>Отмена</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(forAll)} style={styles.btnDanger}>
              <Text style={styles.btnDangerText}>Удалить</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = themedStyles(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0d0a14',
    borderWidth: 1,
    borderColor: L.border,
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Tiny5',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  message: {
    color: 'rgba(226,226,226,0.55)',
    fontSize: 12,
    fontFamily: 'JetBrainsMono_400Regular',
    lineHeight: 18,
    marginBottom: 16,
  },
  cbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: L.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: L.accent, borderColor: L.accent },
  cbLabel: { color: 'rgba(226,226,226,0.85)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  btnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  btnGhost: {
    borderWidth: 1,
    borderColor: L.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  btnGhostText: { color: 'rgba(226,226,226,0.7)', fontSize: 11, fontFamily: 'JetBrainsMono_400Regular' },
  btnDanger: { backgroundColor: L.accent, paddingHorizontal: 14, paddingVertical: 9 },
  btnDangerText: { color: '#000', fontSize: 11, fontFamily: 'JetBrainsMono_700Bold' },
}));
