import api from './client';
import { setLauncherThemeById } from '@/theme/appTheme';

export type ShopItemType = 'avatar' | 'frame' | 'banner' | 'theme' | 'tag' | 'background' | 'miniprofile_bg';
export type ShopRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ShopScope = 'profile' | 'launcher';

export interface ShopTag {
  id: number;
  name: string;
  category?: string;
}

export interface ShopItem {
  id: number;
  type: ShopItemType;
  name: string;
  price: number;
  rarity: ShopRarity;
  /** для тем: профиль или весь лаунчер */
  scope?: ShopScope;
  image_url: string;
  payload: string;
  tags?: ShopTag[];
  /** Только для подписчиков Lustre Pro */
  pro_only?: boolean;
  /** Анимированная рамка/аватар */
  animated?: boolean;
  is_video?: boolean;
  /** Ранний доступ Pro за N дней до открытия для всех */
  early_days?: number;
  /** Заблокирован без подписки */
  locked?: boolean;
  /** Скрыт: ранний доступ ещё не открылся */
  hidden?: boolean;
  /** Уже куплен (приходит прямо в карточке — источник истины для статуса) */
  owned?: boolean;
}

export interface ShopLimits {
  groups: number;
  group_members: number;
  showcases: number;
  favorites: number;
  collections: number;
  upload_mb: number;
  coin_limit: number;
  daily_bonus: number;
  plan: string;
  gift_per_month: number;
}

export interface ShopData {
  items: ShopItem[];
  owned: number[];
  coins: number;
  is_pro?: boolean;
  pro_plan?: string;
  frame_id: string;
  avatar_frame_scale?: number;
  launcher_theme_id?: string;
  bonus_ready: boolean;
  next_bonus_at: string | null;
  limits?: ShopLimits;
}

/** Ответ покупки: новый баланс, id предмета, применён ли он сразу */
export interface BuyResult {
  coins: number;
  owned_item_id: number;
  equipped: boolean;
  profile?: unknown;
}

/** Каталог + инвентарь + баланс. Без кэша: витрина читается заново при открытии. */
export async function getShop(): Promise<ShopData> {
  const res = await api.get('/shop/');
  return res.data as ShopData;
}

export async function buyItem(itemId: number): Promise<BuyResult> {
  const res = await api.post('/shop/buy', { item_id: itemId });
  return res.data as BuyResult;
}

// Возвращает обновлённый профиль (надетый предмет уже применён).
// Рамки всегда в натуральном размере — масштаб не передаём (как и десктоп).
export async function equipItem(itemId: number): Promise<unknown> {
  const res = await api.post('/shop/equip', { item_id: itemId });
  const profile = (res.data as { profile?: { launcher_theme_id?: string } } | undefined)?.profile;
  // Экипировка темы лаунчера сразу перекрашивает приложение
  if (profile && typeof profile.launcher_theme_id === 'string') {
    setLauncherThemeById(profile.launcher_theme_id);
  }
  return profile;
}

// Снять предмет слота (вернуть дефолт). type: theme | launcher_theme | frame | avatar | banner
export async function unequipSlot(type: string, itemId?: number): Promise<unknown> {
  const res = await api.post('/shop/unequip', { type, ...(itemId ? { item_id: itemId } : {}) });
  const profile = (res.data as { profile?: { launcher_theme_id?: string } } | undefined)?.profile;
  if (profile && typeof profile.launcher_theme_id === 'string') {
    setLauncherThemeById(profile.launcher_theme_id);
  }
  return profile;
}

export async function claimDailyBonus(): Promise<{ coins: number; amount: number }> {
  const res = await api.post('/shop/bonus');
  return res.data as { coins: number; amount: number };
}

/**
 * Фон лаунчера ставится отдельным эндпоинтом (сохраняет настройки отображения).
 * Визуально фон применяется в десктоп-лаунчере — в приложении он виден только как превью.
 */
export async function setLauncherBackground(payload: { item_id?: number }): Promise<unknown> {
  const res = await api.post('/launcher/background', payload);
  return (res.data as { profile?: unknown } | undefined)?.profile;
}

// --- Админ ---

export interface ShopItemPayload {
  type: string;
  name: string;
  price: number;
  rarity: string;
  scope?: string;
  image_url?: string;
  payload: string;
  tag_ids?: number[];
  pro_only?: boolean;
  animated?: boolean;
  is_video?: boolean;
  early_days?: number;
}

export async function createShopItem(payload: ShopItemPayload): Promise<ShopItem> {
  const res = await api.post('/shop/create', payload);
  return (res.data as { item: ShopItem }).item;
}

export async function updateShopItem(id: number, payload: ShopItemPayload): Promise<ShopItem> {
  const res = await api.put(`/shop/${id}`, payload);
  return (res.data as { item: ShopItem }).item;
}

export async function deleteShopItem(id: number): Promise<void> {
  await api.delete(`/shop/${id}`);
}
