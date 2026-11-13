import { useSyncExternalStore } from 'react';

import { getCached, setStored } from './storage';

// Игры 18+ скрыты, пока пользователь не подтвердил возраст. При первом входе
// один раз предлагаем их показывать; изменить ответ можно в магазине.
const CONSENT_KEY = 'adultConsent';
const OFFERED_KEY = 'adultOffered';

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function hasAdultConsent(): boolean {
  return getCached(CONSENT_KEY) === '1';
}

export function adultOfferPending(): boolean {
  return !hasAdultConsent() && getCached(OFFERED_KEY) !== '1';
}

export function answerAdultOffer(show: boolean) {
  void setStored(OFFERED_KEY, '1');
  if (show) void setStored(CONSENT_KEY, '1');
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAdultConsent(): boolean {
  return useSyncExternalStore(subscribe, hasAdultConsent);
}

export function useAdultOfferPending(): boolean {
  return useSyncExternalStore(subscribe, adultOfferPending);
}
