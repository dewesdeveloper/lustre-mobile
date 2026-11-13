import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check, Eye, EyeOff, LogOut, Monitor, Pencil, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react-native';

import {
  changePassword,
  confirmTrustDevice,
  listTrustedDevices,
  removeTrustedDevice,
  renameTrustedDevice,
  revokeOtherTrustedDevices,
  revokeTrustedDevice,
  setTrustedDeviceDays,
  startTrustDevice,
  trustedDeviceStatus,
  type TrustedDevice,
} from '@/api/settings';
import { totpStatus } from '@/api/totp';
import { getDeviceToken, removeDeviceToken, saveDeviceToken } from '@/api/deviceTokens';
import { getCachedDeviceInfo } from '@/api/device';
import { useAuth } from '@/context/AuthContext';
import { Row, Section, ToggleRow } from '@/components/settings/ui';import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import { apiError } from '@/utils/apiError';
import { L } from '@/constants/lustre';

const DAY_OPTIONS = [
  { value: 30, label: '30 дней' },
  { value: 60, label: '60 дней' },
  { value: 90, label: '90 дней' },
  { value: 365, label: '365 дней' },
  { value: 0, label: 'Никогда' },
];

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU');
}

export default function SecuritySettingsScreen() {
  const { user } = useAuth();

  // --- Смена пароля ---
  const [showForm, setShowForm] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // --- Срок подтверждения ---
  const [days, setDays] = useState<number>(user?.trusted_device_days ?? 30);
  const [savingDays, setSavingDays] = useState(false);
  const [daysMsg, setDaysMsg] = useState('');

  // --- Доверенное устройство ---
  const [trusted, setTrusted] = useState(false);
  const [daysLeft, setDaysLeft] = useState(0);
  const [hoursLeft, setHoursLeft] = useState(0);
  const [forever, setForever] = useState(false);
  const [trustLoading, setTrustLoading] = useState(true);
  const [trustBusy, setTrustBusy] = useState(false);
  const [trustToken, setTrustToken] = useState('');
  const [trustCode, setTrustCode] = useState('');
  const [trustError, setTrustError] = useState('');
  const [showTrustCode, setShowTrustCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // --- Устройства ---
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesError, setDevicesError] = useState('');
  const [renamingId, setRenamingId] = useState('');
  const [renameValue, setRenameValue] = useState('');

  // --- 2FA (TOTP) ---
  const [totpOn, setTotpOn] = useState(false);

  const username = user?.username || '';

  const loadDevices = useCallback(async () => {
    try {
      setDevices(await listTrustedDevices(getDeviceToken(username)));
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, [username]);

  const refreshTrust = useCallback(async () => {
    const token = getDeviceToken(username);
    if (!token) {
      setTrusted(false);
      setTrustLoading(false);
      return;
    }
    try {
      const st = await trustedDeviceStatus(token);
      setTrusted(st.trusted);
      setDaysLeft(st.days_left);
      setHoursLeft(st.hours_left);
      setForever(st.forever);
    } catch {
      setTrusted(false);
    } finally {
      setTrustLoading(false);
    }
  }, [username]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshTrust();
      void loadDevices();
      void totpStatus().then(setTotpOn).catch(() => {});
    }, 0);
    const hour = setInterval(() => void refreshTrust(), 60 * 60 * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(hour);
    };
  }, [refreshTrust, loadDevices]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submitPassword = async () => {
    setError('');
    setOk('');
    if (next.length < 6) {
      setError('Новый пароль — минимум 6 символов');
      return;
    }
    if (next !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setOk('Пароль изменён. Доверенные устройства сброшены.');
      setCurrent('');
      setNext('');
      setConfirm('');
      removeDeviceToken(username);
      setTrusted(false);
      void loadDevices();
      setTimeout(() => {
        setShowForm(false);
        setOk('');
      }, 2500);
    } catch (e) {
      setError(apiError(e, 'Не удалось изменить пароль'));
    } finally {
      setBusy(false);
    }
  };

  const changeDays = async (d: number) => {
    if (d === days || savingDays) return;
    setSavingDays(true);
    setDaysMsg('');
    try {
      await setTrustedDeviceDays(d);
      setDays(d);
      setDaysMsg('Сохранено');
      void refreshTrust();
      setTimeout(() => setDaysMsg(''), 2000);
    } catch (e) {
      setDaysMsg(apiError(e, 'Не удалось сохранить'));
    } finally {
      setSavingDays(false);
    }
  };

  const toggleTrust = async () => {
    setTrustError('');
    setTrustBusy(true);
    try {
      if (trusted) {
        await revokeTrustedDevice(getDeviceToken(username));
        removeDeviceToken(username);
        setTrusted(false);
        setShowTrustCode(false);
        void loadDevices();
      } else {
        const res = await startTrustDevice();
        setTrustToken(res.trust_token);
        setTrustCode('');
        setShowTrustCode(true);
      }
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { retry_after?: number; error?: string } } };
      if (err?.response?.status === 429 && err.response.data?.retry_after) {
        setCooldown(err.response.data.retry_after);
      }
      setTrustError(err?.response?.data?.error || 'Не удалось выполнить действие');
    } finally {
      setTrustBusy(false);
    }
  };

  const confirmTrust = async () => {
    if (!trustCode.trim()) return;
    setTrustBusy(true);
    setTrustError('');
    try {
      const token = await confirmTrustDevice(trustToken, trustCode);
      saveDeviceToken(username, token);
      setShowTrustCode(false);
      setTrustCode('');
      await refreshTrust();
      void loadDevices();
    } catch (e) {
      setTrustError(apiError(e, 'Неверный код'));
    } finally {
      setTrustBusy(false);
    }
  };

  const removeDevice = async (d: TrustedDevice) => {
    setDevicesBusy(true);
    setDevicesError('');
    try {
      await removeTrustedDevice(d.id, d.device_id);
      if (d.current) {
        removeDeviceToken(username);
        setTrusted(false);
      }
      await loadDevices();
    } catch (e) {
      setDevicesError(apiError(e, 'Не удалось удалить устройство'));
    } finally {
      setDevicesBusy(false);
    }
  };

  const saveRename = async (d: TrustedDevice) => {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId('');
      return;
    }
    setDevicesBusy(true);
    setDevicesError('');
    try {
      await renameTrustedDevice(d.id, d.device_id, name);
      setRenamingId('');
      await loadDevices();
    } catch (e) {
      setDevicesError(apiError(e, 'Не удалось переименовать устройство'));
    } finally {
      setDevicesBusy(false);
    }
  };

  const revokeOthers = async () => {
    setDevicesBusy(true);
    setDevicesError('');
    try {
      await revokeOtherTrustedDevices(getCachedDeviceInfo().id);
      await loadDevices();
    } catch (e) {
      setDevicesError(apiError(e, 'Не удалось выйти на других устройствах'));
    } finally {
      setDevicesBusy(false);
    }
  };

  const trustInfo = !trusted
    ? 'Устройство не доверено — код из письма запрашивается при каждом входе.'
    : forever
      ? 'Повторное подтверждение: никогда.'
      : `Повторное подтверждение через ${daysLeft} д. ${hoursLeft} ч.`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Безопасность</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ===== 2FA (TOTP) ===== */}
        <Section title="Двухфакторная защита">
          <Row
            label="Приложение-аутентификатор (TOTP)"
            hint={totpOn ? 'Включено' : 'Выключено'}
            icon={
              totpOn ? (
                <ShieldCheck size={18} color={L.success} />
              ) : (
                <ShieldOff size={18} color={L.muted} />
              )
            }
            onPress={() => router.push('/two-factor')}
            last
          />
        </Section>

        {/* ===== Смена пароля ===== */}
        <Section>
          <View style={styles.pwHead}>
            <View style={styles.pwHeadBody}>
              <Text style={styles.pwLabel}>Логин</Text>
              <Text style={styles.pwValue}>{user?.username || '—'}</Text>
            </View>
            <Pressable
              onPress={() => {
                setShowForm((v) => !v);
                setError('');
                setOk('');
              }}
              style={styles.pwToggleBtn}
              hitSlop={8}>
              <Text style={styles.pwToggleText}>{showForm ? 'Отмена' : 'Изменить пароль'}</Text>
            </Pressable>
          </View>

          {showForm && (
            <View style={styles.pwForm}>
              <Label>Текущий пароль</Label>
              <Input
                value={current}
                onChangeText={setCurrent}
                secureTextEntry={!visible}
                placeholder="Текущий пароль"
              />
              <Label>Новый пароль</Label>
              <Input
                value={next}
                onChangeText={setNext}
                secureTextEntry={!visible}
                placeholder="Новый пароль"
              />
              <Label>Повторите новый пароль</Label>
              <View style={styles.pwConfirmRow}>
                <Input
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!visible}
                  placeholder="Повторите новый пароль"
                  style={styles.pwConfirmInput}
                />
                <Pressable onPress={() => setVisible((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                  {visible ? (
                    <EyeOff size={18} color={L.muted} />
                  ) : (
                    <Eye size={18} color={L.muted} />
                  )}
                </Pressable>
              </View>
              <ErrorText>{error}</ErrorText>
              {ok ? <Text style={styles.ok}>{ok}</Text> : null}
              <Button
                title="Сохранить новый пароль"
                onPress={submitPassword}
                loading={busy}
                disabled={!current || !next || !confirm}
              />
            </View>
          )}
        </Section>

        {/* ===== Срок подтверждения ===== */}
        <Section title="Срок подтверждения">
          <Text style={styles.paragraph}>
            Через сколько дней устройство перестаёт быть доверенным и при входе снова запрашивается код из письма.
          </Text>
          <View style={styles.daysRow}>
            {DAY_OPTIONS.map((o) => {
              const active = days === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => void changeDays(o.value)}
                  disabled={savingDays}
                  style={[styles.dayChip, active && styles.dayChipActive, savingDays && styles.chipDisabled]}>
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {daysMsg ? (
            <Text style={daysMsg === 'Сохранено' ? styles.ok : styles.err}>{daysMsg}</Text>
          ) : null}
        </Section>

        {/* ===== Доверенное устройство ===== */}
        <Section>
          <ToggleRow
            label="Доверенное устройство"
            hint={trustLoading ? 'Проверяем...' : trustInfo}
            value={trusted}
            onValueChange={() => void toggleTrust()}
            disabled={trustBusy || cooldown > 0}
          />
          {cooldown > 0 ? (
            <Text style={styles.paragraph}>
              Слишком много запросов кода. Повторите через {cooldown} с.
            </Text>
          ) : null}

          {showTrustCode && !trusted ? (
            <View style={styles.trustForm}>
              <Text style={styles.paragraph}>Введите код из письма, чтобы доверять этому устройству.</Text>
              <Input
                value={trustCode}
                onChangeText={(v) => setTrustCode(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="Код из письма"
                style={styles.codeInput}
              />
              <ErrorText>{trustError}</ErrorText>
              <Button
                title="Подтвердить устройство"
                onPress={confirmTrust}
                loading={trustBusy}
                disabled={!trustCode.trim()}
              />
            </View>
          ) : null}

          {trustError && !showTrustCode ? <ErrorText>{trustError}</ErrorText> : null}
        </Section>

        {/* ===== Устройства аккаунта ===== */}
        <Section title="Устройства аккаунта">
          <Text style={styles.paragraph}>Устройства, на которых вход не требует код из письма.</Text>

          {devices.length > 1 ? (
            <Pressable onPress={() => void revokeOthers()} disabled={devicesBusy} style={styles.revokeAll}>
              <LogOut size={14} color={L.danger} />
              <Text style={styles.revokeAllText}>Выйти на всех других</Text>
            </Pressable>
          ) : null}

          <ErrorText>{devicesError}</ErrorText>

          {devicesLoading ? (
            <Text style={styles.paragraph}>Загружаем устройства...</Text>
          ) : devices.length === 0 ? (
            <Text style={styles.paragraph}>Нет доверенных устройств.</Text>
          ) : (
            <View style={styles.devices}>
              {devices.map((d) => {
                const rowKey = d.device_id || `id-${d.id}`;
                const isRenaming = renamingId === rowKey;
                return (
                  <View key={rowKey} style={styles.deviceRow}>
                    <Monitor size={16} color={d.current ? L.success : L.muted} />
                    <View style={styles.deviceBody}>
                      {isRenaming ? (
                        <Input
                          value={renameValue}
                          onChangeText={setRenameValue}
                          maxLength={60}
                          placeholder="Название устройства"
                          style={styles.renameInput}
                        />
                      ) : (
                        <View style={styles.deviceNameRow}>
                          <Text style={styles.deviceName} numberOfLines={1}>
                            {d.device_name}
                          </Text>
                          {d.current ? (
                            <View style={styles.currentChip}>
                              <Text style={styles.currentChipText}>Это устройство</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                      <Text style={styles.deviceMeta} numberOfLines={1}>
                        {d.platform || 'Платформа неизвестна'}
                        {d.last_seen_at ? ` · вход ${timeAgo(d.last_seen_at)}` : ''}
                      </Text>
                    </View>

                    {isRenaming ? (
                      <Pressable
                        onPress={() => void saveRename(d)}
                        disabled={devicesBusy}
                        style={styles.iconBtn}
                        hitSlop={6}>
                        <Check size={14} color={L.accent} />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setRenamingId(rowKey);
                          setRenameValue(d.device_name);
                        }}
                        disabled={devicesBusy}
                        style={styles.iconBtn}
                        hitSlop={6}>
                        <Pencil size={13} color={L.muted} />
                      </Pressable>
                    )}

                    {!d.current ? (
                      <Pressable
                        onPress={() => void removeDevice(d)}
                        disabled={devicesBusy}
                        style={styles.iconBtn}
                        hitSlop={6}>
                        <Trash2 size={13} color={L.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  paragraph: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 18, marginBottom: 10 },
  ok: { color: L.success, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 10, fontWeight: '700' },
  err: { color: L.danger, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 10 },
  pwHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pwHeadBody: { flex: 1, minWidth: 0 },
  pwLabel: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', textTransform: 'uppercase', letterSpacing: 1 },
  pwValue: { color: L.text, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', marginTop: 2 },
  pwToggleBtn: { borderWidth: 1, borderColor: L.border, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8 },
  pwToggleText: { color: L.text, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  pwForm: { marginTop: 8 },
  pwConfirmRow: { position: 'relative' },
  pwConfirmInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: 14, top: 14 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: L.cardAlt,
  },
  dayChipActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.12)' },
  chipDisabled: { opacity: 0.5 },
  dayChipText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },
  dayChipTextActive: { color: L.text },
  trustForm: { marginTop: 12, gap: 4 },
  codeInput: { fontSize: 20, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 8, textAlign: 'center' },
  revokeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,77,79,0.4)',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  revokeAllText: { color: L.danger, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  devices: { gap: 10, marginTop: 4 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    backgroundColor: L.cardAlt,
    padding: 12,
  },
  deviceBody: { flex: 1, minWidth: 0 },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceName: { color: L.text, fontSize: 13, fontFamily: 'JetBrainsMono_700Bold', flexShrink: 1 },
  currentChip: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  currentChipText: { color: L.success, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', },
  deviceMeta: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_400Regular', marginTop: 3 },
  renameInput: { paddingVertical: 8, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular' },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
