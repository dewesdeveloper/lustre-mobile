import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, X } from 'lucide-react-native';

import { buildInviteLink } from '@/api/community';
import { L } from '@/constants/lustre';

interface Props {
  visible: boolean;
  name: string;
  code: string;
  onClose: () => void;
}

export default function InviteModal({ visible, name, code, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const link = code ? buildInviteLink(code) : '';

  const copy = async () => {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={styles.title}>
                Ссылка-<Text style={styles.accent}>приглашение</Text>
              </Text>
              <Text style={styles.name}>{name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <X size={18} color={L.muted} />
            </Pressable>
          </View>

          <Text style={styles.text}>
            Сообщество приватное: его нет в общем списке. Отправьте эту ссылку игрокам — вступить можно
            только по ней.
          </Text>

          <View style={styles.linkRow}>
            <TextInput value={link} editable={false} selectTextOnFocus style={styles.link} />
            <Pressable onPress={() => void copy()} style={[styles.copyBtn, copied && styles.copyBtnOn]}>
              <Copy size={14} color={copied ? L.success : L.text} />
              <Text style={[styles.copyText, copied && styles.copyTextOn]}>
                {copied ? 'Готово' : 'Копировать'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    padding: 20,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  close: { padding: 2 },
  title: { color: L.text, fontSize: 17, fontFamily: 'Tiny5', },
  accent: { color: L.accent },
  name: {
    color: L.muted,
    fontSize: 11, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 6,
  },
  text: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19, marginTop: 14 },
  linkRow: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' },
  link: {
    flex: 1,
    minWidth: 0,
    backgroundColor: L.cardAlt,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: L.text,
    fontSize: 12, fontFamily: 'JetBrainsMono_400Regular',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copyBtnOn: { borderColor: L.success },
  copyText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase' },
  copyTextOn: { color: L.success },
}));
