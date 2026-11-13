import { themedStyles } from '@/theme/themedStyles';
import { useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '@/components/ui/form';
import { L } from '@/constants/lustre';

/** Достаём токен подтверждения из отсканированного QR. */
function extractToken(data: string): string | null {
  if (!data) return null;
  const match = /[?&]token=([^&]+)/.exec(data);
  if (match) return decodeURIComponent(match[1]);
  if (/^[A-Za-z0-9]{16,}$/.test(data)) return data;
  return null;
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const onScanned = (result: BarcodeScanningResult) => {
    if (handled.current) return;
    const token = extractToken(result.data);
    if (!token) return;
    handled.current = true;
    router.replace(`/approve?token=${encodeURIComponent(token)}` as Href);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={20} color={L.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Сканировать QR</Text>
      </View>

      {!permission ? (
        <View style={styles.center} />
      ) : !permission.granted ? (
        <View style={styles.center}>
          <Text style={styles.hint}>Нужен доступ к камере, чтобы отсканировать QR-код с экрана компьютера.</Text>
          <Button title="Разрешить камеру" onPress={() => void requestPermission()} />
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
          <View style={styles.frame} pointerEvents="none" />
          <Text style={styles.caption}>Наведите камеру на QR-код на экране входа</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  headerTitle: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  hint: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', lineHeight: 20 },
  cameraWrap: { flex: 1, overflow: 'hidden' },
  camera: { flex: 1 },
  frame: { position: 'absolute', top: '28%', left: '15%', right: '15%', height: '34%', borderWidth: 2, borderColor: L.accent, borderRadius: 0 },
  caption: { position: 'absolute', bottom: 32, left: 0, right: 0, textAlign: 'center', color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
}));
