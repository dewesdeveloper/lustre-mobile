import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import api, { startSessionKeepAlive } from '@/api/client';
import { initDeviceInfo } from '@/api/device';
import { saveDeviceToken } from '@/api/deviceTokens';
import { getJSON, hydrateStorage, removeStored, setJSON } from '@/api/storage';

export type Profile = {
  display_name: string;
  bio: string;
  avatar_url: string;
  avatar_frame_url?: string;
  banner_url: string;
  level: number;
  xp: number;
  is_pro: boolean;
  pro_until?: string | null;
  frame_id: string;
  theme_id: string;
  launcher_theme_id?: string;
};

export type User = {
  id: number;
  username: string;
  email: string;
  friend_code?: string;
  role?: 'user' | 'moderator' | 'manager' | 'admin';
  email_verified?: boolean;
  trusted_device_days?: number;
  profile: Profile;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  /** Завершить вход: сохранить пользователя и (опционально) токен доверенного устройства. */
  completeAuth: (user: User, deviceToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistUser = useCallback(async (u: User | null) => {
    setUser(u);
    if (u) await setJSON('user', u);
    else await removeStored('user');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      await persistUser(res.data.user as User);
    } catch (err: unknown) {
      const e = err as { response?: { status?: number }; sessionCheckUnavailable?: boolean };
      // 401 после неудачного продления из-за сети/сбоя сервера — не выход из аккаунта
      if (e?.response?.status === 401 && !e.sessionCheckUnavailable) await persistUser(null);
      // сетевая ошибка — оставляем кэшированного пользователя
    }
  }, [persistUser]);

  const completeAuth = useCallback(
    async (u: User, deviceToken?: string) => {
      if (deviceToken && u.username) saveDeviceToken(u.username, deviceToken);
      await persistUser(u);
    },
    [persistUser],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // игнорируем — всё равно выходим локально
    } finally {
      await removeStored('token');
      await persistUser(null);
    }
  }, [persistUser]);

  useEffect(() => {
    const init = async () => {
      await hydrateStorage();
      await initDeviceInfo();

      const saved = getJSON<User | null>('user', null);
      if (saved) setUser(saved);

      try {
        const res = await api.get('/auth/me');
        await persistUser(res.data.user as User);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number }; sessionCheckUnavailable?: boolean };
        if (e?.response?.status === 401 && !e.sessionCheckUnavailable) await persistUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [persistUser]);

  // Пока пользователь в аккаунте — продлеваем сессию заранее (токен живёт 72 ч)
  const signedIn = !!user;
  useEffect(() => {
    if (!signedIn) return;
    return startSessionKeepAlive();
  }, [signedIn]);

  return (
    <AuthContext.Provider value={{ user, isLoading, completeAuth, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
