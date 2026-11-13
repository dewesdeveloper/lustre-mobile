import { router, type Href } from 'expo-router';

/**
 * Переход по абсолютному пути (например, '/shop/cosmetics').
 * Typed-routes пересобираются dev-сервером, поэтому путь передаётся строкой —
 * так экраны компилируются и до, и после регенерации .expo/types.
 */
export function go(path: string): void {
  router.push(path as Href);
}
