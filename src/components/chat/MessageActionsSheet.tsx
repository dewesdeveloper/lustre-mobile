import { themedStyles } from '@/theme/themedStyles';
import { Modal, Pressable, Text, View } from 'react-native';
import { Check, Copy, Forward, Pencil, Pin, Reply, Trash2, X } from 'lucide-react-native';
import { L } from '@/constants/lustre';

export interface MessageActions {
  canReply: boolean;
  canEdit: boolean;
  canPin: boolean;
  canForward: boolean;
  pinned: boolean;
  hasText: boolean;
}

interface MessageActionsSheetProps {
  visible: boolean;
  actions: MessageActions;
  onReply: () => void;
  onEdit: () => void;
  onPin: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onClose: () => void;
}

/** Bottom-sheet действий над сообщением: тап по сообщению. */
export const MessageActionsSheet = ({
  visible, actions, onReply, onEdit, onPin, onCopy, onForward, onDelete, onSelect, onClose,
}: MessageActionsSheetProps) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
        {actions.canReply ? (
          <SheetItem icon={<Reply size={16} color={L.muted} />} label="Ответить" onPress={onReply} />
        ) : null}
        {actions.canEdit ? (
          <SheetItem icon={<Pencil size={16} color={L.muted} />} label="Редактировать" onPress={onEdit} />
        ) : null}
        {actions.canPin ? (
          <SheetItem
            icon={<Pin size={16} color={L.muted} />}
            label={actions.pinned ? 'Открепить' : 'Закрепить'}
            onPress={onPin}
          />
        ) : null}
        <View style={styles.sep} />
        {actions.hasText ? (
          <SheetItem icon={<Copy size={16} color={L.muted} />} label="Копировать текст" onPress={onCopy} />
        ) : null}
        {actions.canForward ? (
          <SheetItem icon={<Forward size={16} color={L.muted} />} label="Переслать" onPress={onForward} />
        ) : null}
        <SheetItem icon={<Trash2 size={16} color={L.muted} />} label="Удалить" danger onPress={onDelete} />
        <View style={styles.sep} />
        <SheetItem icon={<Check size={16} color={L.muted} />} label="Выбрать" onPress={onSelect} />
        <SheetItem icon={<X size={16} color={L.muted} />} label="Отмена" onPress={onClose} />
      </Pressable>
    </Pressable>
  </Modal>
);

function SheetItem({ icon, label, onPress, danger }: {
  icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
      {icon}
      <Text style={[styles.itemLabel, danger && styles.itemDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0d0a14',
    borderTopWidth: 1,
    borderTopColor: L.border,
    paddingTop: 6,
    paddingBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  itemPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  itemLabel: { color: 'rgba(226,226,226,0.85)', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  itemDanger: { color: L.danger },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 5 },
}));
