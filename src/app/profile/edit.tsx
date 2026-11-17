import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,

  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Check, X } from 'lucide-react-native';

import {
  deleteProfileImage,
  getPrivacy,
  getShopData,
  parseTags,
  updatePrivacy,
  updateProfile,
  uploadProfileImage,
  type EditProfileForm,
  type PrivacySettings,
  type ShopItem,
} from '@/api/profile';
import TagsEditor from '@/components/profile/TagsEditor';
import { Button, ErrorText, Input, Label } from '@/components/ui/form';
import { L } from '@/constants/lustre';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/utils/apiError';

const buildForm = (u: { profile?: Partial<EditProfileForm> } | null): EditProfileForm => ({
  display_name: u?.profile?.display_name || '',
  bio: u?.profile?.bio || '',
  tags: parseTags(u?.profile),
  avatar_url: u?.profile?.avatar_url || '',
  banner_url: u?.profile?.banner_url || '',
});

type Visibility = 'public' | 'friends' | 'private';

export default function EditProfileScreen() {
  const { user, refreshUser } = useAuth();

  const [form, setForm] = useState<EditProfileForm>(() => buildForm(user));
  const initialForm = useMemo(() => buildForm(user), [user]);
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Черновые загрузки (выбраны, но профиль ещё не сохранён). Прежний файл удаляется только после
  // сохранения: раньше он стирался сразу при выборе новой картинки, и «Отмена» оставляла в
  // хранилище ненужную загрузку, а профиль — со ссылкой на удалённый файл.
  const drafts = useRef(new Set<string>());
  const savedRef = useRef(false);
  const ownPrefix = user ? `/users/${user.id}/` : '';
  useEffect(() => () => {
    // ушли без сохранения — черновые загрузки не нужны
    if (!savedRef.current) drafts.current.forEach((u) => void deleteProfileImage(u));
    drafts.current.clear();
  }, []);

  // Купленные косметические предметы (аватары/фоны/титулы)
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<number[]>([]);
  useEffect(() => {
    let alive = true;
    getShopData()
      .then((d) => {
        if (!alive) return;
        setShopItems(d.items);
        setOwned(d.owned);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const ownedAvatarItems = useMemo(
    () => shopItems.filter((i) => i.type === 'avatar' && owned.includes(i.id)),
    [shopItems, owned],
  );
  const ownedBannerItems = useMemo(
    () => shopItems.filter((i) => i.type === 'banner' && owned.includes(i.id)),
    [shopItems, owned],
  );
  const ownedTagItems = useMemo(
    () => shopItems.filter((i) => i.type === 'tag' && owned.includes(i.id)),
    [shopItems, owned],
  );

  // Приватность — сохраняется сразу при переключении (как на десктопе)
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacyError, setPrivacyError] = useState('');

  const loadPrivacy = useCallback(async () => {
    try {
      const p = await getPrivacy();
      setPrivacy(p);
      setPrivacyError('');
    } catch (e) {
      setPrivacyError(apiError(e, 'Не удалось загрузить настройки приватности'));
    } finally {
      setPrivacyLoading(false);
    }
  }, []);

  const retryPrivacy = () => {
    setPrivacyLoading(true);
    setPrivacyError('');
    void loadPrivacy();
  };

  useFocusEffect(
    useCallback(() => {
      void loadPrivacy();
    }, [loadPrivacy]),
  );

  useEffect(() => {
    return () => {
      if (backTimer.current) clearTimeout(backTimer.current);
    };
  }, []);

  const updPrivacy = async (patch: Partial<PrivacySettings>) => {
    if (!privacy) return;
    const prev = privacy;
    setPrivacy({ ...privacy, ...patch });
    setPrivacyError('');
    try {
      const next = await updatePrivacy(patch);
      setPrivacy(next);
    } catch (e) {
      setPrivacy(prev);
      setPrivacyError(apiError(e, 'Не удалось сохранить настройки приватности'));
    }
  };

  const pickImage = async (folder: 'avatars' | 'backgrounds') => {
    if (!user) return;
    const isAvatar = folder === 'avatars';
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Нет доступа к галерее — разрешите доступ в настройках устройства');
      return;
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
    if (isAvatar) {
      options.allowsEditing = true;
      options.aspect = [1, 1];
    }

    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await ImagePicker.launchImageLibraryAsync(options);
    } catch {
      setError('Не удалось открыть галерею');
      return;
    }
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;

    const maxMb = isAvatar ? 4 : 6;
    if (asset.fileSize && asset.fileSize > maxMb * 1024 * 1024) {
      setError(`Максимальный размер файла — ${maxMb} МБ`);
      return;
    }

    setError('');
    if (isAvatar) setUploadingAvatar(true);
    else setUploadingBanner(true);
    try {
      const oldUrl = isAvatar ? form.avatar_url : form.banner_url;
      const url = await uploadProfileImage(folder, user.id, {
        uri: asset.uri,
        name: asset.fileName || undefined,
        mimeType: asset.mimeType || undefined,
      });
      if (!url) throw new Error('Пустой ответ загрузки');
      setForm((prev) => ({ ...prev, [isAvatar ? 'avatar_url' : 'banner_url']: url }));
      // заменили прежнюю черновую загрузку — её можно удалить сразу; сохранённую — только после «Сохранить»
      if (oldUrl && oldUrl !== url && drafts.current.has(oldUrl)) {
        drafts.current.delete(oldUrl);
        void deleteProfileImage(oldUrl);
      }
      drafts.current.add(url);
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить изображение'));
    } finally {
      if (isAvatar) setUploadingAvatar(false);
      else setUploadingBanner(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const before = initialForm;
      await updateProfile(form);
      // профиль сохранён: прежние свои файлы и неиспользованные черновики больше не нужны
      for (const field of ['avatar_url', 'banner_url'] as const) {
        const old = before[field];
        if (old && old !== form[field] && ownPrefix && old.includes(ownPrefix)) void deleteProfileImage(old);
      }
      drafts.current.forEach((u) => {
        if (u !== form.avatar_url && u !== form.banner_url) void deleteProfileImage(u);
      });
      drafts.current.clear();
      savedRef.current = true;
      await refreshUser();
      setSaved(true);
      backTimer.current = setTimeout(() => router.back(), 900);
    } catch (e) {
      setError(apiError(e, 'Не удалось сохранить настройки.'));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    drafts.current.forEach((u) => void deleteProfileImage(u));
    drafts.current.clear();
    setForm(initialForm);
    setSaved(false);
    setError('');
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator color={L.accent} style={styles.loader} />
      </SafeAreaView>
    );
  }

  const username = user.username;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <Text style={styles.title}>Настройки профиля</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* АВАТАР */}
        <Panel title="АВАТАР">
          <View style={styles.avatarRow}>
            {form.avatar_url ? (
              <Image source={{ uri: form.avatar_url }} style={styles.avatarPreview} />
            ) : (
              <View style={[styles.avatarPreview, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>{(username || '?')[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarActions}>
              <Pressable
                onPress={() => void pickImage('avatars')}
                disabled={uploadingAvatar}
                style={[styles.miniBtn, uploadingAvatar && styles.miniBtnDisabled]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={L.text} />
                ) : (
                  <Text style={styles.miniBtnText}>Загрузить аватар</Text>
                )}
              </Pressable>
              {form.avatar_url ? (
                <Pressable onPress={() => setForm((p) => ({ ...p, avatar_url: '' }))} style={styles.miniBtnGhost}>
                  <X size={14} color={L.muted} />
                  <Text style={styles.miniBtnGhostText}>Удалить</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Text style={styles.hint}>PNG / JPG до 4 МБ · минимум 512×512</Text>

          {ownedAvatarItems.length > 0 && (
            <View style={styles.subBlock}>
              <Label>Купленные аватары</Label>
              <View style={styles.avatarGrid}>
                {ownedAvatarItems.map((item) => {
                  const active = form.avatar_url === item.payload;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setForm((p) => ({ ...p, avatar_url: item.payload }))}
                      style={[styles.avatarCell, active && styles.avatarCellActive]}>
                      <Image source={{ uri: item.image_url }} style={styles.avatarCellImg} />
                      {active ? (
                        <View style={styles.avatarCellCheck}>
                          <Check size={14} color={L.accent} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </Panel>

        {/* БАННЕР */}
        <Panel title="БАННЕР">
          <View style={styles.bannerPreview}>
            {form.banner_url ? (
              <Image source={{ uri: form.banner_url }} style={styles.bannerImg} />
            ) : (
              <Text style={styles.bannerEmpty}>Фон не выбран</Text>
            )}
          </View>
          <View style={styles.bannerActions}>
            <Pressable
              onPress={() => void pickImage('backgrounds')}
              disabled={uploadingBanner}
              style={[styles.miniBtn, uploadingBanner && styles.miniBtnDisabled]}>
              {uploadingBanner ? (
                <ActivityIndicator size="small" color={L.text} />
              ) : (
                <Text style={styles.miniBtnText}>Загрузить фон</Text>
              )}
            </Pressable>
            {form.banner_url ? (
              <Pressable onPress={() => setForm((p) => ({ ...p, banner_url: '' }))} style={styles.miniBtnGhost}>
                <X size={14} color={L.muted} />
                <Text style={styles.miniBtnGhostText}>Удалить</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.hint}>PNG / JPG до 6 МБ · рекомендуется 1920×480</Text>

          {ownedBannerItems.length > 0 && (
            <View style={styles.subBlock}>
              <Label>Купленные фоны</Label>
              <View style={styles.bannerGrid}>
                {ownedBannerItems.map((item) => {
                  const active = form.banner_url === item.payload;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setForm((p) => ({ ...p, banner_url: item.payload }))}
                      style={[styles.bannerCell, active && styles.bannerCellActive]}>
                      <Image source={{ uri: item.image_url }} style={styles.bannerCellImg} />
                      <View style={styles.bannerCellFoot}>
                        <Text style={[styles.bannerCellName, active && styles.bannerCellNameActive]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {active ? <Check size={14} color={L.accent} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </Panel>

        {/* ОСНОВНЫЕ ДАННЫЕ */}
        <Panel title="ОСНОВНЫЕ ДАННЫЕ">
          <Label>Отображаемое имя</Label>
          <Input
            value={form.display_name}
            onChangeText={(v) => setForm((p) => ({ ...p, display_name: v }))}
            maxLength={40}
          />

          <Label>Никнейм</Label>
          <View style={styles.readonly}>
            <Text style={styles.readonlyAt}>@</Text>
            <Text style={styles.readonlyValue}>{username}</Text>
          </View>
          <Text style={styles.hint}>
            Только латиница, цифры и _. Смена — в настройках аккаунта.
          </Text>
        </Panel>

        {/* О СЕБЕ */}
        <Panel title="О СЕБЕ">
          <View style={styles.bioHead}>
            <Label>Биография</Label>
            <Text style={[styles.counter, form.bio.length >= 300 && styles.counterMax]}>
              {form.bio.length} / 300
            </Text>
          </View>
          <Input
            value={form.bio}
            onChangeText={(v) => setForm((p) => ({ ...p, bio: v }))}
            multiline
            maxLength={300}
            placeholder="Расскажите о себе"
          />
          <Text style={styles.hint}>Коротко и по делу — эту строку увидят все, кто откроет профиль.</Text>
        </Panel>

        {/* ТЕГИ */}
        <Panel title="ТЕГИ И ИНТЕРЕСЫ">
          <TagsEditor
            tags={form.tags}
            onChange={(tags) => setForm((p) => ({ ...p, tags }))}
            shopTagItems={ownedTagItems}
          />
        </Panel>

        {/* ПРИВАТНОСТЬ */}
        <Panel title="ПРИВАТНОСТЬ">
          {privacyLoading ? (
            <ActivityIndicator color={L.accent} />
          ) : !privacy ? (
            <View>
              <ErrorText>{privacyError}</ErrorText>
              <Pressable onPress={retryPrivacy} style={styles.retry}>
                <Text style={styles.retryText}>Повторить</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.privacyList}>
              <Text style={styles.privacyTitle}>Кто видит профиль</Text>
              <Text style={styles.hint}>Скрытый профиль не открывается никому, кроме тебя.</Text>
              <Seg
                value={privacy.profile_visibility}
                options={[
                  { id: 'public', label: 'Публичный' },
                  { id: 'friends', label: 'Друзья' },
                  { id: 'private', label: 'Скрытый' },
                ]}
                onChange={(v) => void updPrivacy({ profile_visibility: v as Visibility })}
              />

              <Text style={[styles.privacyTitle, styles.privacyGap]}>Список друзей</Text>
              <Text style={styles.hint}>Влияет на вкладку друзей в профиле.</Text>
              <Seg
                value={privacy.friends_visibility}
                options={[
                  { id: 'public', label: 'Публичный' },
                  { id: 'friends', label: 'Друзья' },
                  { id: 'private', label: 'Скрытый' },
                ]}
                onChange={(v) => void updPrivacy({ friends_visibility: v as Visibility })}
              />

              <Text style={[styles.privacyTitle, styles.privacyGap]}>Кому видно библиотеку</Text>
              <Text style={styles.hint}>Кто видит твои игры в профиле.</Text>
              <Seg
                value={privacy.library_visibility ?? 'friends'}
                options={[
                  { id: 'public', label: 'Все' },
                  { id: 'friends', label: 'Друзья' },
                  { id: 'private', label: 'Только я' },
                ]}
                onChange={(v) => void updPrivacy({ library_visibility: v as Visibility })}
              />

              <Text style={[styles.privacyTitle, styles.privacyGap]}>Лента активности</Text>
              <Text style={styles.hint}>Кто видит твою активность в профиле.</Text>
              <Seg
                value={privacy.activity_visibility}
                options={[
                  { id: 'public', label: 'Все' },
                  { id: 'friends', label: 'Друзья' },
                  { id: 'private', label: 'Только я' },
                ]}
                onChange={(v) => void updPrivacy({ activity_visibility: v as Visibility })}
              />

              <Text style={[styles.privacyTitle, styles.privacyGap]}>Личные сообщения</Text>
              <Seg
                value={privacy.dms}
                options={[
                  { id: 'everyone', label: 'Все' },
                  { id: 'friends', label: 'Друзья' },
                ]}
                onChange={(v) => void updPrivacy({ dms: v as 'everyone' | 'friends' })}
              />

              <Text style={[styles.privacyTitle, styles.privacyGap]}>Голосовые звонки</Text>
              <Seg
                value={privacy.calls}
                options={[
                  { id: 'everyone', label: 'Все' },
                  { id: 'friends', label: 'Друзья' },
                ]}
                onChange={(v) => void updPrivacy({ calls: v as 'everyone' | 'friends' })}
              />

              <View style={[styles.switchRow, styles.privacyGap]}>
                <View style={styles.switchLabel}>
                  <Text style={styles.privacyTitle}>Заявки в друзья</Text>
                  <Text style={styles.hint}>Получать заявки от всех пользователей.</Text>
                </View>
                <Switch
                  value={privacy.friend_requests === 'everyone'}
                  onValueChange={(v) => void updPrivacy({ friend_requests: v ? 'everyone' : 'nobody' })}
                  trackColor={{ false: L.cardAlt, true: L.accent }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Text style={styles.privacyTitle}>Онлайн-статус</Text>
                  <Text style={styles.hint}>Показывать статус «в сети».</Text>
                </View>
                <Switch
                  value={privacy.show_online}
                  onValueChange={(v) => void updPrivacy({ show_online: v })}
                  trackColor={{ false: L.cardAlt, true: L.accent }}
                  thumbColor="#fff"
                />
              </View>

              <ErrorText>{privacyError}</ErrorText>
            </View>
          )}
        </Panel>

        {/* ДЕЙСТВИЯ */}
        <Panel title="ДЕЙСТВИЯ">
          {dirty ? (
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <Text style={styles.statusText}>Есть несохранённые изменения</Text>
            </View>
          ) : null}
          {saved ? (
            <View style={styles.statusRow}>
              <Check size={13} color={L.success} />
              <Text style={[styles.statusText, styles.savedText]}>Настройки сохранены</Text>
            </View>
          ) : null}

          <Button title="Сохранить изменения" onPress={() => void save()} loading={saving} />
          <View style={styles.actionRow}>
            <Button title="Отмена" onPress={() => router.back()} variant="ghost" />
            <Button title="Сброс" onPress={reset} variant="ghost" />
          </View>
          <Text style={styles.hint}>Изменения видны только вам до сохранения.</Text>
        </Panel>

        <ErrorText>{error}</ErrorText>
      </ScrollView>
    </SafeAreaView>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            style={[styles.segBtn, active && styles.segBtnActive]}>
            <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  loader: { marginTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  back: { padding: 4 },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  title: { color: L.text, fontSize: 16, fontFamily: 'JetBrainsMono_700Bold', },
  content: { padding: 20, paddingTop: 4, paddingBottom: 48 },

  panel: {
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 16,
    marginBottom: 14,
  },
  panelTitle: {
    color: L.text,
    fontSize: 11, fontFamily: 'Tiny5',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  hint: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', lineHeight: 17, marginTop: 8 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarPreview: { width: 88, height: 88, borderRadius: 0, borderWidth: 2, borderColor: L.accent, backgroundColor: L.cardAlt },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: L.text, fontSize: 30, fontFamily: 'Tiny5', },
  avatarActions: { flex: 1, gap: 8 },

  miniBtn: {
    backgroundColor: L.cardAlt,
    borderWidth: 1,
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  miniBtnDisabled: { opacity: 0.6 },
  miniBtnText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  miniBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    paddingVertical: 10,
  },
  miniBtnGhostText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', },

  subBlock: { marginTop: 16 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatarCell: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    overflow: 'hidden',
  },
  avatarCellActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.08)' },
  avatarCellImg: { width: '100%', height: '100%' },
  avatarCellCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 0,
    padding: 3,
  },

  bannerPreview: {
    height: 96,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bannerImg: { width: '100%', height: '100%' },
  bannerEmpty: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  bannerActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  bannerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bannerCell: {
    width: '48%',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    overflow: 'hidden',
    backgroundColor: L.cardAlt,
  },
  bannerCellActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.08)' },
  bannerCellImg: { width: '100%', height: 64 },
  bannerCellFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: L.border,
  },
  bannerCellName: { color: L.muted, fontSize: 10, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', flex: 1 },
  bannerCellNameActive: { color: L.accent },

  readonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: L.cardAlt,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readonlyAt: { color: L.muted, fontSize: 15, fontFamily: 'JetBrainsMono_400Regular' },
  readonlyValue: { color: L.text, fontSize: 15, fontFamily: 'JetBrainsMono_700Bold', },

  bioHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', marginTop: 16 },
  counterMax: { color: L.accent },

  privacyList: { gap: 6 },
  privacyGap: { marginTop: 16 },
  privacyTitle: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', letterSpacing: 0.6 },
  seg: { flexDirection: 'row', gap: 6, marginTop: 8 },
  segBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.cardAlt,
    borderRadius: 0,
    paddingVertical: 9,
    alignItems: 'center',
  },
  segBtnActive: { borderColor: L.accent, backgroundColor: 'rgba(255,0,110,0.12)' },
  segText: { color: L.muted, fontSize: 11, fontFamily: 'JetBrainsMono_700Bold', },
  segTextActive: { color: L.accent },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 10,
  },
  switchLabel: { flex: 1 },
  retry: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: L.borderStrong,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 8,
  },
  retryText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 8, height: 8, borderRadius: 0, backgroundColor: '#fbbf24' },
  statusText: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  savedText: { color: L.success },
  actionRow: { flexDirection: 'row', gap: 10 },
}));
