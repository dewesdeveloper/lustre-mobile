import api from './client';

export type ProPlanId = 'month' | 'quarter' | 'year';

export interface ProPlan {
  id: ProPlanId;
  title: string;
  months: number;
  price: number;
  old_price: number;
  per_month: number;
  save_pct: number;
  save_total: number;
  gift_per_month: number;
  gift_total: number;
  badge: string;
  highlight: boolean;
  gift_notice: string;
}

export interface ProBenefit {
  key: string;
  title: string;
  hint: string;
  pro_only: boolean;
}

export interface ProLimits {
  groups: number;
  group_members: number;
  showcases: number;
  favorites: number;
  collections: number;
  upload_mb: number;
  coin_limit: number;
  daily_bonus: number;
  plan: ProPlanId | '';
  gift_per_month: number;
}

export interface SubscriptionStatus {
  is_pro: boolean;
  pro_until: string | null;
  pro_plan: ProPlanId | '';
  days_left: number;
  coins: number;
  bonus_ready: boolean;
  next_bonus_at: string | null;
  coin_limit: number;
  base_limit: number;
  daily_bonus: number;
  base_bonus: number;
  pro_frame_id: string;
  frame_id: string;
  avatar_frame_url: string;
  plans: ProPlan[];
  benefits: ProBenefit[];
  limits: ProLimits;
  gift_granted: boolean;
  gift_amount: number;
  gift_per_month: number;
  gift_total: number;
  gift_next_at: string | null;
  gift_months_done: number;
}

/** Длина сообщения в чате (как на сервере): 4096 символов, с Lustre Pro — 32 768 */
export function chatMessageLimit(profile?: { is_pro?: boolean; pro_until?: string | null } | null): number {
  const active = !!profile?.is_pro && (!profile.pro_until || new Date(profile.pro_until).getTime() > Date.now());
  return active ? 32768 : 4096;
}

export async function getSubscription(): Promise<SubscriptionStatus> {
  const res = await api.get('/subscriptions/');
  return res.data as SubscriptionStatus;
}

/** Оформление подписки по тарифу */
export async function subscribePro(payload?: { plan?: ProPlanId; method?: string; months?: number }): Promise<unknown> {
  const res = await api.post('/subscriptions/subscribe', {
    plan: payload?.plan || 'month',
    method: payload?.method || 'card',
    months: payload?.months || 1,
  });
  return (res.data as { profile?: unknown } | undefined)?.profile;
}

export async function cancelPro(): Promise<unknown> {
  const res = await api.post('/subscriptions/cancel');
  return (res.data as { profile?: unknown } | undefined)?.profile;
}

/** Активация промокода */
export async function redeemProPromo(code: string): Promise<{ days: number; profile?: unknown }> {
  const res = await api.post('/subscriptions/promo', { code });
  return res.data as { days: number; profile?: unknown };
}

/** Выдача подписки администратором */
export async function grantPro(payload: { username: string; plan?: ProPlanId; months?: number }): Promise<unknown> {
  const res = await api.post('/subscriptions/grant', payload);
  return res.data as unknown;
}
