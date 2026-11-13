import { StyleSheet } from 'react-native';

import { subscribeTheme } from './appTheme';

/**
 * Замена StyleSheet.create для темизированных стилей.
 *
 * Фабрика выполняется заново при смене темы лаунчера: значения вида
 * `color: L.accent` / `borderColor: L.border` перечитываются из живых
 * токенов (L — геттеры на текущую тему). Компоненты подхватывают новые
 * значения при следующей перерисовке (навигация, фокус, состояние).
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(factory: () => T): T {
  // Тот же контекстный тип, что у StyleSheet.create (T extends NamedStyles<T>) —
  // литералы вида textAlign: 'center' сужаются корректно.
  const create = StyleSheet.create as unknown as (styles: T) => T;
  let cache: T = create(factory());
  subscribeTheme(() => {
    cache = create(factory());
  });
  return new Proxy(cache as object, {
    get: (_target, prop) => (cache as Record<PropertyKey, unknown>)[prop],
    getOwnPropertyDescriptor: (_target, prop) => {
      const value = (cache as Record<PropertyKey, unknown>)[prop];
      if (value === undefined) return undefined;
      return { value, writable: true, enumerable: true, configurable: true };
    },
  }) as T;
}
