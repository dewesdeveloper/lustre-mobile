import api from './client';

export type ActivityKind =
  | 'library_add' | 'favorite' | 'badge_earned' | 'comment'
  | 'follow' | 'group' | 'review' | 'title_equip' | 'level_up';

export interface ActivityItem {
  id: number;
  user_id?: number;
  kind: ActivityKind;
  target_type?: string;
  target_id?: number;
  target_name?: string;
  target_image?: string;
  created_at: string;
  meta?: {
    code?: string;
    rarity?: string;
    excerpt?: string;
    positive?: boolean;
    neutral?: boolean;
    reply?: boolean;
  };
}

export interface ActivityFeed {
  items: ActivityItem[];
  next_before: number;
  has_more: boolean;
  summary_7d: Partial<Record<ActivityKind, number>>;
}

/** Лента активности текущего пользователя (с пагинацией и фильтром по kind). */
export async function fetchActivityFeed(
  params: { limit?: number; before?: number; kind?: ActivityKind | 'all' } = {},
): Promise<ActivityFeed> {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.before) q.set('before', String(params.before));
  if (params.kind && params.kind !== 'all') q.set('kind', params.kind);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const res = await api.get(`/activity/${suffix}`);
  const data = res.data as Partial<ActivityFeed> | undefined;
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    next_before: data?.next_before || 0,
    has_more: !!data?.has_more,
    summary_7d: data?.summary_7d || {},
  };
}

/** Лента активности пользователя по нику (для блока на профиле). */
export async function getUserActivity(username: string, limit = 25): Promise<ActivityFeed> {
  const res = await api.get(`/activity/user/${encodeURIComponent(username)}?limit=${limit}`);
  const data = res.data as Partial<ActivityFeed> | undefined;
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    next_before: data?.next_before || 0,
    has_more: !!data?.has_more,
    summary_7d: data?.summary_7d || {},
  };
}

/** Короткий срез ленты для виджета на главной (не роняет экран при ошибке сети). */
export async function getActivityFeed(limit = 4): Promise<ActivityItem[]> {
  try {
    const data = await fetchActivityFeed({ limit });
    return data.items;
  } catch {
    return [];
  }
}
