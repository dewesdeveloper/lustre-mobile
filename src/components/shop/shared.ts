import type { DimensionValue } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Frame, Image as ImageIcon, LayoutTemplate, MonitorPlay, Palette, Tags, Wallpaper } from 'lucide-react-native';

import type { ShopData, ShopItem } from '@/api/shop';

/** Профиль пользователя в формате витрины: поля читаются динамически. */
export type ShopProfile = Record<string, unknown>;

export const RARITY_LABEL: Record<string, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

export const RARITY_COLOR: Record<string, string> = {
  common: '#94A3B8',
  rare: '#22D3EE',
  epic: '#8338EC',
  legendary: '#EAB308',
};

export const RARITY_WEIGHT: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export const TYPE_META: Record<string, { title: string; subtitle: string; label: string; icon: LucideIcon }> = {
  avatar: { title: 'Аватары', subtitle: 'Подари лицу настроение', label: 'Аватар', icon: ImageIcon },
  frame: { title: 'Рамки аватара', subtitle: 'Рамка с характером — вокруг твоего аватара', label: 'Рамка аватара', icon: Frame },
  banner: { title: 'Фоны профиля', subtitle: 'Пусть профиль отражает твои вкусы', label: 'Фон профиля', icon: Wallpaper },
  theme: { title: 'Темы', subtitle: 'Перекрась весь лаунчер — или только профиль', label: 'Тема', icon: Palette },
  tag: { title: 'Титулы', subtitle: 'Подчеркни свой статус в профиле', label: 'Титул', icon: Tags },
  background: { title: 'Фоны лаунчера', subtitle: 'Изображение или видео вместо фоновой сетки', label: 'Фон лаунчера', icon: MonitorPlay },
  miniprofile_bg: { title: 'Фоны минипрофиля', subtitle: 'Фон карточки минипрофиля', label: 'Фон минипрофиля', icon: LayoutTemplate },
};

export const DESCRIPTIONS: Record<string, string> = {
  avatar: 'Этот аватар появится в твоём профиле, в чате и в списках друзей.',
  frame: 'Рамка обрамляет твой аватар по всему лаунчеру — её увидят все, кто откроет профиль.',
  banner: 'Фон украсит шапку твоего профиля — его видят все, кто его откроет.',
  theme: 'Тема перекрасит лаунчер: акценты, свечения и фон интерфейса.',
  tag: 'Титул показывается в шапке твоего профиля рядом с ником. Можно носить до 4 титулов из магазина и 1 свой.',
  miniprofile_bg: 'Фон появляется в карточке минипрофиля, которую видят при наведении на аватар в чате, комментариях и друзьях.',
  background: 'Фон заменяет фоновую сетку лаунчера. Изображение или видео — настраивается в десктоп-клиенте.',
};

export const DESCRIPTIONS_THEME: Record<string, string> = {
  launcher: 'Глобальная тема: весь лаунчер перекрасится — акценты, свечения, фон. Действует в каждом окне.',
  profile: 'Тема профиля: изменит оформление твоей страницы профиля, лаунчер останется прежним.',
};

export const SORTS = [
  { id: 'new', label: 'Сначала новинки' },
  { id: 'price_asc', label: 'Сначала дешёвые' },
  { id: 'price_desc', label: 'Сначала дорогие' },
  { id: 'rarity', label: 'По редкости' },
  { id: 'name', label: 'По названию' },
];

const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** Группировка разрядов без зависимости от Intl в Hermes. */
export function nf(n: number): string {
  const num = Math.round(Number(n) || 0);
  const neg = num < 0;
  const digits = String(Math.abs(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return neg ? `−${digits}` : digits;
}

/** «05 декабря 2026» — как в десктоп-клиенте. */
export function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Относительное время для истории операций. */
export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThis = new Date(d);
  startOfThis.setHours(0, 0, 0, 0);
  const days = Math.round((startOfToday.getTime() - startOfThis.getTime()) / 86400000);
  if (days === 0) return `сегодня, ${time}`;
  if (days === 1) return `вчера, ${time}`;
  if (days > 1 && days < 7) return `${WEEKDAYS_SHORT[d.getDay()]}, ${time}`;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${time}`;
}

/** «14:30» — время по ISO/мс/Date (детерминированно, без Date.now() в рендере). */
export function fmtClock(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === '') return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Ширина в процентах для прогресс-баров (RN принимает только literal-строки). */
export function pctWidth(pct: number): DimensionValue {
  const v = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return `${v.toFixed(2)}%` as DimensionValue;
}

/** HEX + альфа → rgba(...) для «градиентных» заливок на RN. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function isImagePayload(p: string): boolean {
  return /^(https?:\/\/|data:)/i.test(p);
}

/** Титулы профиля: JSON-массив, либо legacy-поле tag — нужны id предметов магазина. */
export function profileTagItemIds(profile: ShopProfile | null | undefined): number[] {
  if (!profile) return [];
  const out: number[] = [];
  const push = (t: unknown) => {
    if (t && typeof t === 'object') {
      const id = (t as { item_id?: unknown }).item_id;
      if (typeof id === 'number' && id) out.push(id);
    }
  };
  const raw = profile.tags;
  if (Array.isArray(raw)) raw.forEach(push);
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach(push);
    } catch {
      // legacy-поле tag разбираем ниже
    }
  }
  return out;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

export function isEquipped(item: ShopItem, profile: ShopProfile | null | undefined): boolean {
  if (!profile) return false;
  switch (item.type) {
    case 'theme':
      return item.scope === 'launcher'
        ? str(profile.launcher_theme_id) === item.payload
        : str(profile.theme_id) === item.payload;
    case 'frame':
      return isImagePayload(item.payload)
        ? str(profile.avatar_frame_url) === item.payload
        : str(profile.frame_id) === item.payload && !str(profile.avatar_frame_url);
    case 'avatar':
      return str(profile.avatar_url) === item.payload;
    case 'banner':
      return str(profile.banner_url) === item.payload;
    case 'tag':
      return profileTagItemIds(profile).includes(item.id);
    case 'background':
      return num(profile.launcher_background_item_id) === item.id;
    case 'miniprofile_bg':
      return num(profile.miniprofile_background_item_id) === item.id;
    default:
      return false;
  }
}

export function unequipTypeFor(item: ShopItem): string {
  return item.type === 'theme' ? (item.scope === 'launcher' ? 'launcher_theme' : 'theme') : item.type;
}

const TYPE_LABEL: Record<string, string> = {
  avatar: 'аватар',
  frame: 'рамка аватара',
  banner: 'фон профиля',
  tag: 'титул',
  background: 'фон лаунчера',
  miniprofile_bg: 'фон минипрофиля',
};

export function typeLabel(item: ShopItem): string {
  if (item.type === 'theme') return item.scope === 'launcher' ? 'тема лаунчера' : 'тема профиля';
  return TYPE_LABEL[item.type] || item.type;
}

export function typeTitle(item: ShopItem): string {
  if (item.type === 'theme') return item.scope === 'launcher' ? 'Тема лаунчера' : 'Тема профиля';
  return TYPE_META[item.type]?.label || item.type;
}

/** Статус «куплен» — из карточки товара (присылает сервер), с запасным вариантом по списку owned. */
export function isOwned(item: ShopItem, data: ShopData | null | undefined): boolean {
  if (typeof item.owned === 'boolean') return item.owned;
  return !!data?.owned.includes(item.id);
}
