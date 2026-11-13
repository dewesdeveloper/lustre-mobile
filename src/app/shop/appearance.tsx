import { themedStyles } from '@/theme/themedStyles';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  Frame as FrameIcon,
  Image as ImageIcon,
  MonitorPlay,
  Palette,
  ShoppingBag,
  Sparkles,
  Wallpaper,
  type LucideIcon,
} from 'lucide-react-native';

import { equipItem, getShop, setLauncherBackground, unequipSlot, type ShopData, type ShopItem } from '@/api/shop';
import { go } from '@/components/shop/nav';
import OwnedItemCard from '@/components/shop/OwnedItemCard';
import Segmented from '@/components/shop/Segmented';
import {
  isEquipped,
  isOwned,
  unequipTypeFor,
  type ShopProfile,
} from '@/components/shop/shared';
import DataState from '@/components/ui/DataState';
import { useAuth } from '@/context/AuthContext';
import { L } from '@/constants/lustre';
import { apiError } from '@/utils/apiError';

type ViewKey = 'all' | 'launcher' | 'profile';

interface Section {
  key: string;
  scope: 'launcher' | 'profile';
  title: string;
  hint: string;
  desktopOnly?: boolean;
  icon: LucideIcon;
  items: ShopItem[];
}

export default function AppearanceScreen() {
  const { user, refreshUser } = useAuth();

  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [view, setView] = useState<ViewKey>('all');

  const profile = (user?.profile ?? {}) as ShopProfile;

  const load = useCallback(async () => {
    try {
      setData(await getShop());
      setError('');
    } catch (e) {
      setError(apiError(e, 'Не удалось загрузить кастомизации'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const owned = useMemo(() => (data?.items || []).filter((i) => isOwned(i, data)), [data]);

  const handleEquip = async (item: ShopItem) => {
    setBusyId(item.id);
    try {
      if (item.type === 'background') {
        await setLauncherBackground({ item_id: item.id });
      } else {
        await equipItem(item.id);
      }
      await refreshUser();
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert('Ошибка', msg || 'Не удалось надеть предмет');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnequip = async (item: ShopItem) => {
    setBusyId(item.id);
    try {
      if (item.type === 'background') {
        await setLauncherBackground({});
      } else {
        await unequipSlot(unequipTypeFor(item), item.id);
      }
      await refreshUser();
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert('Ошибка', msg || 'Не удалось снять предмет');
    } finally {
      setBusyId(null);
    }
  };

  const sections: Section[] = useMemo(() => {
    const all: Section[] = [
      {
        key: 'launcher-theme',
        scope: 'launcher',
        title: 'Темы лаунчера',
        hint: 'Оформление всего интерфейса',
        desktopOnly: true,
        icon: Sparkles,
        items: owned.filter((i) => i.type === 'theme' && i.scope === 'launcher'),
      },
      {
        key: 'background',
        scope: 'launcher',
        title: 'Фоны лаунчера',
        hint: 'Фоновая картинка или видео вместо сетки',
        desktopOnly: true,
        icon: MonitorPlay,
        items: owned.filter((i) => i.type === 'background'),
      },
      {
        key: 'theme',
        scope: 'profile',
        title: 'Темы профиля',
        hint: 'Цвета и оформление страницы',
        icon: Palette,
        items: owned.filter((i) => i.type === 'theme' && i.scope !== 'launcher'),
      },
      {
        key: 'frame',
        scope: 'profile',
        title: 'Рамки аватара',
        hint: 'Обрамление вашего аватара',
        icon: FrameIcon,
        items: owned.filter((i) => i.type === 'frame'),
      },
      {
        key: 'banner',
        scope: 'profile',
        title: 'Баннеры',
        hint: 'Фон шапки профиля',
        icon: Wallpaper,
        items: owned.filter((i) => i.type === 'banner'),
      },
      {
        key: 'avatar',
        scope: 'profile',
        title: 'Аватары',
        hint: 'Ваше изображение профиля',
        icon: ImageIcon,
        items: owned.filter((i) => i.type === 'avatar'),
      },
    ];
    return all.filter((s) => s.items.length > 0 && (view === 'all' || s.scope === view));
  }, [owned, view]);

  const equippedItems = owned.filter((i) => isEquipped(i, profile));
  const currentProfileTheme = owned.find(
    (i) => i.type === 'theme' && i.scope !== 'launcher' && profile.theme_id === i.payload,
  );
  const currentLauncherTheme = owned.find(
    (i) => i.type === 'theme' && i.scope === 'launcher' && profile.launcher_theme_id === i.payload,
  );
  const currentBanner = owned.find((i) => i.type === 'banner' && isEquipped(i, profile));
  const bannerUri =
    currentBanner && (currentBanner.image_url || currentBanner.payload) ? currentBanner.image_url || currentBanner.payload : '';

  const avatarUri = typeof profile.avatar_url === 'string' ? profile.avatar_url : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <View style={styles.flex1}>
            <Text style={styles.title}>ВНЕШНИЙ ВИД</Text>
            <Text style={styles.sub}>Приобретённые кастомизации · {owned.length}</Text>
          </View>
          <Pressable onPress={() => go('/shop/cosmetics')} style={({ pressed }) => [styles.shopBtn, pressed && styles.pressed]}>
            <ShoppingBag size={14} color="#fff" />
            <Text style={styles.shopBtnText}>В магазин</Text>
          </Pressable>
        </View>
      </View>

      {loading || (error && !data) ? (
        <DataState loading={loading} error={loading ? '' : error} onRetry={() => void load()} />
      ) : owned.length === 0 ? (
        <View style={styles.emptyBox}>
          <Palette size={34} color="rgba(139,139,147,0.7)" />
          <Text style={styles.emptyTitle}>Пока ничего не приобретено</Text>
          <Text style={styles.emptyText}>Купите темы, рамки и баннеры в магазине кастомизаций</Text>
          <Pressable onPress={() => go('/shop/cosmetics')} style={({ pressed }) => [styles.shopBtn, pressed && styles.pressed]}>
            <ShoppingBag size={14} color="#fff" />
            <Text style={styles.shopBtnText}>Перейти в магазин</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* НАДЕТО СЕЙЧАС */}
          <View style={styles.loadout}>
            <View style={styles.loadoutAvatarWrap}>
              <View style={styles.loadoutAvatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.loadoutAvatarImg} />
                ) : (
                  <Text style={styles.loadoutAvatarLetter}>{(user?.username || '?')[0]?.toUpperCase()}</Text>
                )}
              </View>
            </View>
            <View style={styles.flex1}>
              <Text style={styles.loadoutKicker}>Надето сейчас</Text>
              <Text style={styles.loadoutName} numberOfLines={1}>
                {typeof profile.display_name === 'string' && profile.display_name
                  ? profile.display_name
                  : user?.username || 'Игрок'}
              </Text>
              <View style={styles.chipRow}>
                <LoadoutChip label="Профиль" value={currentProfileTheme?.name || 'Стандартная тема'} />
                <LoadoutChip label="Лаунчер" value={currentLauncherTheme?.name || 'Стандартная тема'} />
              </View>
            </View>
            {bannerUri ? (
              <View style={styles.bannerBox}>
                <Image source={{ uri: bannerUri }} style={styles.bannerImg} resizeMode="cover" />
                <Text style={styles.bannerLabel}>Баннер</Text>
              </View>
            ) : null}
          </View>

          {/* ФИЛЬТР РАЗДЕЛОВ */}
          <View style={styles.tabsRow}>
            <View style={styles.flex1}>
              <Segmented
                options={[
                  { id: 'all', label: 'Все' },
                  { id: 'launcher', label: 'Лаунчер' },
                  { id: 'profile', label: 'Профиль' },
                ]}
                value={view}
                onChange={(id) => setView(id as ViewKey)}
              />
            </View>
            <Text style={styles.equippedCount}>Надето: {equippedItems.length}</Text>
          </View>

          {/* РАЗДЕЛЫ */}
          {sections.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyTitle}>В этом разделе пока нет приобретённых предметов</Text>
            </View>
          ) : (
            sections.map((section) => {
              const Icon = section.icon;
              return (
                <View key={section.key} style={styles.section}>
                  <View style={styles.sectionHead}>
                    <View style={styles.sectionBar} />
                    <Icon size={15} color={L.accent} />
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={styles.sectionCount}>{section.items.length}</Text>
                  </View>
                  <Text style={styles.sectionHint}>{section.hint}</Text>
                  {section.desktopOnly ? (
                    <Text style={styles.desktopNote}>Полный превью доступен в десктоп-клиенте</Text>
                  ) : null}

                  <View style={styles.grid}>
                    {section.items.map((item) => (
                      <View key={item.id} style={styles.cell}>
                        <OwnedItemCard
                          item={item}
                          equipped={isEquipped(item, profile)}
                          busy={busyId === item.id}
                          profile={profile}
                          onToggle={() => {
                            if (isEquipped(item, profile)) void handleUnequip(item);
                            else void handleEquip(item);
                          }}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}

          <Pressable onPress={() => go('/inventory')} style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}>
            <Text style={styles.ghostBtnText}>Открыть инвентарь</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LoadoutChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.loadoutChip}>
      <Text style={styles.loadoutChipLabel}>{label}:</Text>
      <Text style={styles.loadoutChipValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  safe: { flex: 1, backgroundColor: L.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, gap: 4 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: L.accent, fontSize: 14, fontFamily: 'JetBrainsMono_700Bold', },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8 },
  flex1: { flex: 1, minWidth: 0 },
  title: { color: L.text, fontSize: 24, fontFamily: 'Tiny5', letterSpacing: 1 },
  sub: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', letterSpacing: 0.4, marginTop: 4, textTransform: 'uppercase' },
  pressed: { opacity: 0.75 },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 0,
    backgroundColor: L.accent,
  },
  shopBtnText: { color: '#fff', fontSize: 11, fontFamily: 'Tiny5', textTransform: 'uppercase', letterSpacing: 1 },
  ghostBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: L.border,
    marginTop: 4,
  },
  ghostBtnText: { color: L.text, fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', textTransform: 'uppercase', letterSpacing: 1 },

  content: { padding: 16, paddingBottom: 48, gap: 14 },

  emptyBox: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 48 },
  emptySection: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { color: L.muted, fontSize: 12, fontFamily: 'Tiny5', letterSpacing: 1.6, textTransform: 'uppercase', textAlign: 'center' },
  emptyText: { color: 'rgba(139,139,147,0.8)', fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', textAlign: 'center', lineHeight: 19 },

  loadout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: L.card,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    padding: 16,
    overflow: 'hidden',
  },
  loadoutAvatarWrap: { alignItems: 'center' },
  loadoutAvatar: {
    width: 68,
    height: 68,
    borderRadius: 0,
    borderWidth: 3,
    borderColor: L.borderStrong,
    backgroundColor: L.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loadoutAvatarImg: { width: '100%', height: '100%' },
  loadoutAvatarLetter: { color: '#fff', fontSize: 24, fontFamily: 'Tiny5', },
  loadoutKicker: { color: L.muted, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 2.4, textTransform: 'uppercase' },
  loadoutName: { color: '#fff', fontSize: 17, fontFamily: 'Tiny5', marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  loadoutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  loadoutChipLabel: { color: L.muted, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1, textTransform: 'uppercase' },
  loadoutChipValue: { color: '#fff', fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', flexShrink: 1 },
  bannerBox: { width: 96, height: 64, borderRadius: 0, overflow: 'hidden', borderWidth: 1, borderColor: L.border },
  bannerImg: { width: '100%', height: '100%' },
  bannerLabel: {
    position: 'absolute',
    left: 6,
    bottom: 4,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10, fontFamily: 'Tiny5',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  tabsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  equippedCount: { color: L.muted, fontSize: 10, fontFamily: 'Tiny5', letterSpacing: 1.4, textTransform: 'uppercase' },

  section: { gap: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBar: { width: 4, height: 16, borderRadius: 0, backgroundColor: L.accent },
  sectionTitle: { color: '#fff', fontSize: 12, fontFamily: 'Tiny5', letterSpacing: 1.2, textTransform: 'uppercase', flex: 1 },
  sectionCount: {
    color: L.muted,
    fontSize: 10, fontFamily: 'Tiny5',
    backgroundColor: L.cardAlt,
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  sectionHint: { color: L.muted, fontSize: 12, fontFamily: 'JetBrainsMono_400Regular' },
  desktopNote: {
    color: 'rgba(139,139,147,0.85)',
    fontSize: 11, fontFamily: 'JetBrainsMono_400Regular',
    fontStyle: 'italic',
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: L.card,
    overflow: 'hidden',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  cell: { flexBasis: '47%', flexGrow: 1 },
}));
