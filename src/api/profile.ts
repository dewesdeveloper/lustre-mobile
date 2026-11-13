import api from './client';

export const MAX_TAGS = 5;
export const MAX_CUSTOM_TAGS = 1;
export const MAX_SHOP_TAGS = 4;

export type ProfileTag = { text: string; color: string; custom: boolean; item_id: number };

/** Разбирает титулы профиля: JSON-массив, либо legacy-поле tag. */
export function parseTags(profile: unknown): ProfileTag[] {
  const raw = (profile as { tags?: unknown; tag?: unknown; tag_color?: unknown } | null | undefined)?.tags;
  const clean = (arr: unknown[]): ProfileTag[] =>
    (arr as Record<string, unknown>[])
      .filter((t) => t && typeof t.text === 'string' && t.text.trim())
      .map((t) => ({
        text: String(t.text),
        color: typeof t.color === 'string' ? t.color : '',
        custom: !!t.custom,
        item_id: Number(t.item_id) || 0,
      }))
      .slice(0, MAX_TAGS);

  try {
    if (Array.isArray(raw)) return clean(raw);
    if (typeof raw === 'string' && raw.trim()) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return clean(parsed);
    }
  } catch {
    // некорректный JSON — падаем на legacy-поле
  }

  const legacy = (profile as { tag?: unknown; tag_color?: unknown } | null | undefined)?.tag;
  if (legacy) {
    const color = (profile as { tag_color?: unknown } | null | undefined)?.tag_color;
    return [{ text: String(legacy), color: typeof color === 'string' ? color : '', custom: true, item_id: 0 }];
  }
  return [];
}

/** Поля, редактируемые в форме профиля (соответствуют десктопному EditProfile). */
export type EditProfileForm = {
  display_name: string;
  bio: string;
  tags: ProfileTag[];
  avatar_url: string;
  banner_url: string;
};

/** Сохранение формы профиля (PUT /user/update). */
export async function updateProfile(form: EditProfileForm): Promise<unknown> {
  const res = await api.put('/user/update', form);
  return res.data;
}

export type UploadFolder = 'avatars' | 'backgrounds' | 'frames';

export interface PickedImage {
  uri: string;
  name?: string;
  mimeType?: string;
}

/** Загрузка изображения профиля (FormData → POST /upload/:folder). */
export async function uploadProfileImage(
  folder: UploadFolder,
  userId: number,
  image: PickedImage,
): Promise<string> {
  const fd = new FormData();
  fd.append('file', {
    uri: image.uri,
    name: image.name || 'upload.jpg',
    type: image.mimeType || 'image/jpeg',
  } as unknown as Blob);
  const res = await api.post(`/upload/${folder}?user_id=${userId}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const url = (res.data as { url?: string } | undefined)?.url;
  return url || '';
}

/** Удаляет прежний файл из хранилища по ключу из URL (best-effort). */
export async function deleteProfileImage(url: string): Promise<void> {
  const match = url.match(/\/lustrehub\/(.+)$/);
  if (!match) return;
  await api.delete(`/upload/?key=${encodeURIComponent(match[1])}`).catch(() => {});
}

export interface PrivacySettings {
  profile_visibility: 'public' | 'friends' | 'private';
  friends_visibility: 'public' | 'friends' | 'private';
  activity_visibility: 'public' | 'friends' | 'private';
  friend_requests: 'everyone' | 'nobody';
  dms: 'everyone' | 'friends';
  calls: 'everyone' | 'friends';
  show_online: boolean;
}

export async function getPrivacy(): Promise<PrivacySettings> {
  const res = await api.get('/privacy/');
  return res.data as PrivacySettings;
}

export async function updatePrivacy(patch: Partial<PrivacySettings>): Promise<PrivacySettings> {
  const res = await api.put('/privacy/', patch);
  return res.data as PrivacySettings;
}

export type ShopRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ShopItem {
  id: number;
  type: string;
  name: string;
  price: number;
  rarity: ShopRarity;
  image_url: string;
  payload: string;
  owned?: boolean;
}

export interface ShopSnapshot {
  items: ShopItem[];
  owned: number[];
}

/** Каталог магазина: нужен только для купленных аватаров/фонов/титулов. */
export async function getShopData(): Promise<ShopSnapshot> {
  const res = await api.get('/shop/');
  const data = res.data as Partial<ShopSnapshot> | undefined;
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    owned: Array.isArray(data?.owned) ? data.owned : [],
  };
}

/** Цвет редкости для титулов из магазина (как на десктопе). */
export const SHOP_RARITY_COLOR: Record<string, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#8338EC',
  legendary: '#FFB020',
};
