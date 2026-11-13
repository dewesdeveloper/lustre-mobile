import { AppState, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import api from './client';

export type PaymentStatus = 'pending' | 'succeeded' | 'canceled' | 'refunded' | 'failed';

export interface PaymentOrderView {
  order_id: number;
  status: PaymentStatus | string;
  product_type: 'pro' | 'coins';
  product_id: string;
  amount: number;
  currency: string;
  coins: number;
  plan: string;
  payment_url: string;
  paid_at: string | null;
  created_at: string;
}

export async function createProPayment(plan: string): Promise<PaymentOrderView> {
  const res = await api.post('/payments/pro', { plan });
  return res.data as PaymentOrderView;
}

export async function createCoinPayment(packageId: string): Promise<PaymentOrderView> {
  const res = await api.post('/payments/coins', { package_id: packageId });
  return res.data as PaymentOrderView;
}

export async function getPayment(orderId: number | string): Promise<PaymentOrderView> {
  const res = await api.get(`/payments/order/${orderId}`);
  return res.data as PaymentOrderView;
}

export function formatOrderAmount(order: PaymentOrderView): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(order.amount / 100));
}

/** Поллинг статуса заказа до терминального состояния. */
export async function pollPayment(
  orderId: number | string,
  opts?: { attempts?: number; intervalMs?: number; shouldStop?: () => boolean },
): Promise<PaymentOrderView | null> {
  const attempts = opts?.attempts ?? 120;
  const intervalMs = opts?.intervalMs ?? 2000;
  let last: PaymentOrderView | null = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0 && opts?.shouldStop?.()) break;
    try {
      last = await getPayment(orderId);
      if (last.status !== 'pending') return last;
    } catch {
      // сеть недоступна во время ожидания — повторим
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return last;
}

/**
 * Открывает платёжную форму и ждёт подтверждения оплаты.
 * iOS: Safari-модалка резолвится при закрытии — поллим после.
 * Android: вкладка открывается сразу — поллим параллельно с оплатой,
 * а после возврата в приложение даём webhook'у ещё несколько секунд.
 */
export async function payWithBrowser(order: PaymentOrderView): Promise<PaymentOrderView | null> {
  if (!order.payment_url) throw new Error('Платёжная ссылка не получена');
  await WebBrowser.openBrowserAsync(order.payment_url);

  if (Platform.OS === 'ios') {
    return pollPayment(order.order_id, { attempts: 40, intervalMs: 1500 });
  }

  let returnedToApp = false;
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') returnedToApp = true;
  });
  try {
    let final = await pollPayment(order.order_id, {
      attempts: 150,
      intervalMs: 2000,
      shouldStop: () => returnedToApp,
    });
    if (!final || final.status === 'pending') {
      final = await pollPayment(order.order_id, { attempts: 12, intervalMs: 1500 });
    }
    return final;
  } finally {
    subscription.remove();
  }
}
