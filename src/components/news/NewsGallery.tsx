import { themedStyles } from '@/theme/themedStyles';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';

import { L } from '@/constants/lustre';

interface Props {
  images: string[];
}

/**
 * Галерея изображений новости: превью со строкой миниатюр,
 * тап по картинке — полноэкранное просмотр в RN Modal.
 */
export default function NewsGallery({ images }: Props) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  if (!images.length) return null;
  const current = images[Math.min(index, images.length - 1)];

  const prev = () => setIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  const next = () => setIndex((i) => (i < images.length - 1 ? i + 1 : 0));

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen(true)} style={styles.main}>
        <Image source={{ uri: current }} style={styles.mainImage} resizeMode="cover" />
        {images.length > 1 ? (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {Math.min(index, images.length - 1) + 1} / {images.length}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {images.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
          {images.map((uri, i) => (
            <Pressable
              key={`${uri}-${i}`}
              onPress={() => setIndex(i)}
              style={[styles.thumb, i === index ? styles.thumbActive : styles.thumbInactive]}>
              <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={styles.modal}>
          <Pressable style={styles.close} onPress={() => setOpen(false)} hitSlop={10}>
            <X size={22} color="#fff" />
          </Pressable>

          <Pressable style={styles.modalBody} onPress={() => setOpen(false)}>
            <Image source={{ uri: current }} style={styles.modalImage} resizeMode="contain" />
          </Pressable>

          {images.length > 1 ? (
            <>
              <Pressable style={[styles.nav, styles.navLeft]} onPress={prev} hitSlop={10}>
                <ChevronLeft size={26} color="#fff" />
              </Pressable>
              <Pressable style={[styles.nav, styles.navRight]} onPress={next} hitSlop={10}>
                <ChevronRight size={26} color="#fff" />
              </Pressable>
              <Text style={styles.modalCounter}>
                {Math.min(index, images.length - 1) + 1} / {images.length}
              </Text>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = themedStyles(() => ({
  wrap: { marginBottom: 16 },
  main: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mainImage: { width: '100%', height: '100%' },
  counter: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  counterText: { color: '#fff', fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 1 },
  thumbs: { gap: 8, paddingTop: 8 },
  thumb: { width: 92, height: 56, borderRadius: 0, overflow: 'hidden', borderWidth: 2 },
  thumbActive: { borderColor: L.accent },
  thumbInactive: { borderColor: 'transparent', opacity: 0.5 },
  thumbImage: { width: '100%', height: '100%' },

  modal: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', top: 54, right: 20, zIndex: 10, padding: 8 },
  modalBody: { flex: 1, justifyContent: 'center' },
  modalImage: { width: '100%', height: '80%' },
  nav: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    padding: 12,
    borderRadius: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  navLeft: { left: 12 },
  navRight: { right: 12 },
  modalCounter: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12, fontFamily: 'JetBrainsMono_700Bold',
    letterSpacing: 2,
  },
}));
