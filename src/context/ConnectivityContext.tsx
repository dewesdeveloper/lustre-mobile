import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { API_URL } from '@/api/config';

type ConnectivityContextType = {
  online: boolean;
  checking: boolean;
  check: () => Promise<boolean>;
};

const ConnectivityContext = createContext<ConnectivityContextType>({
  online: true,
  checking: false,
  check: async () => true,
});

const HEALTH_INTERVAL = 25000;
const HEALTH_TIMEOUT = 8000;
// Один сорвавшийся запрос — ещё не «нет связи»: в мобильном интернете и через VPN единичные
// обрывы бывают постоянно, и раньше из-за них на 25 с появлялась плашка «Нет соединения»
const HEALTH_RETRY_DELAY = 1500;

async function pingHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);
  try {
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Проверяет доступность бэкенда (GET /health), как десктопный лаунчер. */
export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const onlineRef = useRef(true);
  // Проверки не накладываются друг на друга (таймер + возврат в приложение)
  const inFlight = useRef<Promise<boolean> | null>(null);

  const check = useCallback((): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      setChecking(true);
      try {
        let ok = await pingHealth();
        // пока считаем себя в сети, перед плашкой «нет связи» перепроверяем
        if (!ok && onlineRef.current) {
          await new Promise((r) => setTimeout(r, HEALTH_RETRY_DELAY));
          ok = await pingHealth();
        }
        if (ok !== onlineRef.current) {
          onlineRef.current = ok;
          setOnline(ok);
        }
        return ok;
      } finally {
        setChecking(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    const kickoff = setTimeout(() => void check(), 0);
    const interval = setInterval(() => void check(), HEALTH_INTERVAL);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      clearTimeout(kickoff);
      clearInterval(interval);
      sub.remove();
    };
  }, [check]);

  return (
    <ConnectivityContext.Provider value={{ online, checking, check }}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => useContext(ConnectivityContext);
