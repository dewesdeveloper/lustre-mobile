import { themedStyles } from '@/theme/themedStyles';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { ArrowLeft, ShieldCheck, ShieldOff, Phone, QrCode } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

import { totpDisable, totpEnable, totpSetup, totpStatus } from '@/api/totp';
import {
  disableDeviceApproval,
  enableDeviceApproval,
  getDeviceApprovalStatus,
  requestPhoneCode,
  verifyPhoneCode,
} from '@/api/deviceApproval';
import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import { L } from '@/constants/lustre';

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err?.response?.data?.error || err?.message || 'Ошибка';
}

type Stage = 'idle' | 'setup' | 'done';

export default function SecurityScreen() {
  const [loading, setLoading] = useState(true);

  // TOTP
  const [enabled, setEnabled] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [recovery, setRecovery] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Подтверждение входа (device approval)
  const [daEnabled, setDaEnabled] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [daError, setDaError] = useState('');
  const [daInfo, setDaInfo] = useState('');
  const [daBusy, setDaBusy] = useState(false);

  const loadStatus = async () => {
    try {
      const [totp, da] = await Promise.all([totpStatus(), getDeviceApprovalStatus()]);
      setEnabled(totp);
      setDaEnabled(da.enabled);
      setPhone(da.phone || '');
      setPhoneVerified(da.phone_verified);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void loadStatus().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const startSetup = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await totpSetup();
      setSecret(res.secret);
      setOtpauth(res.otpauth_url);
      setStage('setup');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    setBusy(true);
    setError('');
    try {
      const codes = await totpEnable(code.trim());
      setRecovery(codes);
      setEnabled(true);
      setStage('done');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const doDisableTotp = async () => {
    setBusy(true);
    setError('');
    try {
      await totpDisable(disableCode.trim());
      setEnabled(false);
      setStage('idle');
      setDisableCode('');
      setSecret('');
      setOtpauth('');
      setRecovery([]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const sendPhoneCode = async () => {
    if (!phoneInput.trim()) {
      setDaError('Введите номер телефона');
      return;
    }
    setDaBusy(true);
    setDaError('');
    setDaInfo('');
    try {
      await requestPhoneCode(phoneInput.trim());
      setDaInfo('Код отправлен на номер');
    } catch (e) {
      setDaError(errMsg(e));
    } finally {
      setDaBusy(false);
    }
  };

  const confirmPhone = async () => {
    setDaBusy(true);
    setDaError('');
    try {
      await verifyPhoneCode(phoneCode.trim());
      setPhoneVerified(true);
      setDaInfo('Номер подтверждён');
      await loadStatus();
    } catch (e) {
      setDaError(errMsg(e));
    } finally {
      setDaBusy(false);
    }
  };

  const toggleDa = async () => {
    setDaBusy(true);
    setDaError('');
    try {
      if (daEnabled) await disableDeviceApproval();
      else await enableDeviceApproval();
      setDaEnabled(!daEnabled);
    } catch (e) {
      setDaError(errMsg(e));
    } finally {
      setDaBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <ArrowLeft size={20} color={L.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Безопасность</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={L.accent} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* ===== Подтверждение входа (телефон) ===== */}
          <View style={styles.card}>
            <SectionHead
              title="Подтверждение входа"
              on={daEnabled}
              icon={daEnabled ? <ShieldCheck size={16} color={L.success} /> : <ShieldOff size={16} color={L.muted} />}
            />
            <Text style={styles.paragraph}>
              При входе на компьютере появится QR-код. Отсканируйте его этим приложением, чтобы войти.
              Также приходит push-уведомление с запросом.
            </Text>

            <Label>Номер телефона</Label>
            <View style={styles.phoneRow}>
              <Phone size={16} color={L.muted} style={{ marginRight: 8 }} />
              <Input
                value={phoneInput}
                onChangeText={setPhoneInput}
                keyboardType="phone-pad"
                placeholder={phone || '+7 999 000-00-00'}
                editable={!phoneVerified}
                style={{ flex: 1 }}
              />
            </View>

            {phoneVerified ? (
              <View style={styles.okBox}>
                <Text style={styles.ok}>Номер подтверждён: {phone}</Text>
              </View>
            ) : (
              <>
                <Button title="Отправить код на номер" onPress={sendPhoneCode} loading={daBusy} variant="ghost" />
                {phoneInput.trim() ? (
                  <>
                    <Label>Код из SMS</Label>
                    <Input value={phoneCode} onChangeText={setPhoneCode} keyboardType="number-pad" maxLength={6} placeholder="000000" style={styles.codeInput} />
                    <Button title="Подтвердить номер" onPress={confirmPhone} loading={daBusy} />
                  </>
                ) : null}
              </>
            )}

            {phoneVerified && (
              <Button
                title={daEnabled ? 'Отключить подтверждение входа' : 'Включить подтверждение входа'}
                onPress={toggleDa}
                loading={daBusy}
                variant={daEnabled ? 'ghost' : 'primary'}
              />
            )}

            <Pressable style={styles.scanRow} onPress={() => router.push('/scan' as Href)}>
              <QrCode size={15} color={L.accent} />
              <Text style={styles.scanText}>Сканировать QR для подтверждения входа</Text>
            </Pressable>

            {daInfo ? <Text style={styles.info}>{daInfo}</Text> : null}
            <ErrorText>{daError}</ErrorText>
          </View>

          {/* ===== TOTP ===== */}
          <View style={styles.card}>
            <SectionHead
              title="Аутентификатор (TOTP)"
              on={enabled}
              icon={enabled ? <ShieldCheck size={16} color={L.success} /> : <ShieldOff size={16} color={L.muted} />}
            />

            {!enabled && stage === 'idle' && (
              <>
                <Text style={styles.paragraph}>
                  Дополнительно можно подключить TOTP (Google Authenticator, Authy).
                </Text>
                <Button title="Включить TOTP" onPress={startSetup} loading={busy} variant="ghost" />
              </>
            )}

            {!enabled && stage === 'setup' && (
              <>
                <Text style={styles.paragraph}>Отсканируйте QR-код в приложении-аутентификаторе:</Text>
                <View style={styles.qrBox}>
                  <QRCode value={otpauth} size={190} backgroundColor="#ffffff" color="#000000" />
                </View>
                <Pressable onPress={() => Clipboard.setStringAsync(secret)} style={styles.secretRow}>
                  <Text style={styles.secretLabel}>Ключ (если нет QR) — нажмите, чтобы скопировать:</Text>
                  <Text style={styles.secretValue}>{secret}</Text>
                </Pressable>
                <Label>Код из приложения</Label>
                <Input value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" style={styles.codeInput} />
                <Button title="Подтвердить и включить" onPress={confirmEnable} loading={busy} />
              </>
            )}

            {enabled && stage === 'done' && (
              <>
                <Text style={styles.paragraph}>
                  Готово! Сохраните резервные коды — каждый можно использовать один раз.
                </Text>
                <View style={styles.recovery}>
                  {recovery.map((rc) => <Text key={rc} style={styles.recoveryCode}>{rc}</Text>)}
                </View>
              </>
            )}

            {enabled && stage !== 'done' && (
              <>
                <Label>Код для отключения</Label>
                <Input value={disableCode} onChangeText={setDisableCode} keyboardType="number-pad" maxLength={6} placeholder="000000" style={styles.codeInput} />
                <Button title="Отключить TOTP" onPress={doDisableTotp} loading={busy} variant="ghost" />
              </>
            )}

            <ErrorText>{error}</ErrorText>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** Заголовок секции в стиле TL: розовая риска, пиксельный тайтл и чип статуса. */
function SectionHead({ title, on, icon }: { title: string; on: boolean; icon: React.ReactNode }) {
  return (
    <View style={styles.headRow}>
      <View style={styles.headBar} />
      {icon}
      <Text style={styles.headTitle}>{title}</Text>
      <View style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
        <Text style={[styles.chipText, on ? styles.chipTextOn : styles.chipTextOff]}>{on ? 'ВКЛ' : 'ВЫКЛ'}</Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: L.border,
  },
  back: { padding: 4 },
  headerTitle: { color: L.text, fontSize: 12, fontFamily: 'Tiny5', lineHeight: 20 },
  loader: { marginTop: 40 },
  content: { padding: 16, paddingBottom: 48, gap: 16 },
  card: { backgroundColor: L.card, borderRadius: 0, borderWidth: 1, borderColor: L.border, padding: 18 },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headBar: { width: 3, height: 16, backgroundColor: L.accent },
  headTitle: {
    flex: 1,
    color: L.text,
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'Tiny5',
    textTransform: 'uppercase',
  },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: 0 },
  chipOn: { borderColor: 'rgba(52,211,153,0.5)', backgroundColor: 'rgba(52,211,153,0.10)' },
  chipOff: { borderColor: L.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipText: { fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 1 },
  chipTextOn: { color: L.success },
  chipTextOff: { color: L.muted },

  paragraph: { color: L.muted, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 19 },
  phoneRow: { flexDirection: 'row', alignItems: 'center' },
  codeInput: { fontSize: 22, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 8, textAlign: 'center' },
  okBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.5)',
    backgroundColor: 'rgba(52,211,153,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ok: { color: L.success, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold' },
  info: { color: L.violet, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 12 },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    minHeight: 44,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
  },
  scanText: {
    color: L.accent,
    fontSize: 11,
    fontFamily: 'JetBrainsMono_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  qrBox: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    marginTop: 14,
    marginBottom: 14,
  },
  secretRow: { marginBottom: 8, alignItems: 'center' },
  secretLabel: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textTransform: 'uppercase', letterSpacing: 1 },
  secretValue: { color: L.text, fontSize: 13, fontFamily: 'monospace', marginTop: 4 },
  recovery: {
    backgroundColor: L.cardAlt,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    padding: 16,
    marginTop: 14,
    gap: 8,
  },
  recoveryCode: { color: L.text, fontSize: 15, fontFamily: 'monospace', letterSpacing: 2 },
}));
