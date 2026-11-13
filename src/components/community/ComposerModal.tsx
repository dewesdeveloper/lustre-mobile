import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';

import type { Community, UploadFile } from '@/api/community';
import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import { L } from '@/constants/lustre';

export interface ComposerValues {
  communityId: number | null;
  title: string;
  content: string;
  image: UploadFile | null;
}

interface Props {
  visible: boolean;
  heading: string;
  subheading?: string;
  communities?: Community[];
  initialCommunityId?: number;
  allowImage?: boolean;
  submitting?: boolean;
  error?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: ComposerValues) => void;
}

export default function ComposerModal({
  visible,
  heading,
  subheading,
  communities,
  initialCommunityId,
  allowImage,
  submitting,
  error,
  submitLabel,
  onClose,
  onSubmit,
}: Props) {
  const [communityId, setCommunityId] = useState<number | null>(
    () => initialCommunityId ?? communities?.[0]?.ID ?? null,
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<UploadFile | null>(null);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const ext = (a.uri.split('.').pop() || 'jpg').split('?')[0];
    setImage({
      uri: a.uri,
      name: a.fileName || `community_${Date.now()}.${ext}`,
      mimeType: a.mimeType || 'image/jpeg',
    });
  };

  const submit = () => {
    onSubmit({ communityId, title: title.trim(), content: content.trim(), image });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <Text style={styles.title}>{heading}</Text>
              {subheading ? <Text style={styles.sub}>{subheading}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <X size={18} color={L.muted} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {communities && communities.length > 0 ? (
              <>
                <Label>Сообщество *</Label>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.communityRow}>
                  {communities.map((c) => (
                    <Pressable
                      key={c.ID}
                      onPress={() => setCommunityId(c.ID)}
                      style={[styles.communityChip, communityId === c.ID && styles.communityChipOn]}>
                      <Text
                        style={[styles.communityText, communityId === c.ID && styles.communityTextOn]}
                        numberOfLines={1}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <Label>Заголовок</Label>
            <Input
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              placeholder="Заголовок обсуждения *"
            />

            <Label>Текст</Label>
            <Input
              value={content}
              onChangeText={setContent}
              multiline
              placeholder="О чём хотите поговорить?"
            />

            {allowImage ? (
              <>
                <Label>Изображение</Label>
                {image ? (
                  <View style={styles.imageRow}>
                    <Image source={{ uri: image.uri }} style={styles.thumb} />
                    <View style={styles.flex}>
                      <Text style={styles.imageName} numberOfLines={2}>
                        {image.name}
                      </Text>
                      <Pressable onPress={() => setImage(null)} hitSlop={6} style={styles.remove}>
                        <X size={13} color={L.danger} />
                        <Text style={styles.removeText}>Убрать</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable style={styles.pickBtn} onPress={() => void pickImage()}>
                    <Camera size={18} color={L.violet} />
                    <Text style={styles.pickText}>Выбрать изображение</Text>
                  </Pressable>
                )}
                <View style={styles.hintRow}>
                  <ImageIcon size={11} color={L.muted} />
                  <Text style={styles.hint}>Изображение появится в ленте сообщества</Text>
                </View>
              </>
            ) : null}

            <ErrorText>{error}</ErrorText>

            <Button title={submitLabel || 'Опубликовать'} onPress={submit} loading={submitting} />
            <Button title="Отмена" onPress={onClose} variant="ghost" />
          </ScrollView>
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
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    backgroundColor: L.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.borderStrong,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  close: { padding: 2 },
  title: { color: L.text, fontSize: 17, fontFamily: 'Tiny5', },
  sub: {
    color: L.muted,
    fontSize: 10, fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 6,
  },
  body: { paddingBottom: 16 },
  communityRow: { gap: 8, paddingVertical: 4 },
  communityChip: {
    maxWidth: 200,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: L.cardAlt,
  },
  communityChipOn: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.14)' },
  communityText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  communityTextOn: { color: '#fff' },
  imageRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 84, height: 84, borderRadius: 0, backgroundColor: '#000' },
  imageName: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  removeText: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase' },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingVertical: 16,
    backgroundColor: L.cardAlt,
  },
  pickText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  hint: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 15, flex: 1 },
}));
