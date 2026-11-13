#!/usr/bin/env node
/**
 * Закрытый модуль админки: синхронизация с приватным репозиторием.
 *
 * Админка (src/app/admin/, src/components/admin/, src/api/admin.ts) не входит в открытый код и хранится в
 * отдельном приватном репозитории. Официальная сборка подтягивает её перед сборкой:
 *
 *   npm run admin:pull   — скопировать админку из приватного репозитория в проект
 *   npm run admin:push   — вернуть правки админки из проекта в приватный репозиторий
 *
 * Путь к приватному репозиторию: LUSTRE_ADMIN_DIR (по умолчанию ../LustreAdmin),
 * внутри — папка mobile/ с теми же путями, что и в проекте.
 * Без админки приложение собирается и работает — просто без админ-панели.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ADMIN_ROOT = path.resolve(process.env.LUSTRE_ADMIN_DIR || path.join(ROOT, '..', 'LustreAdmin'), 'mobile');
// src/app/admin — экраны Expo Router; .gitkeep остаётся в открытом коде
const PATHS = ['src/app/admin', 'src/components/admin', 'src/api/admin.ts'];

const mode = process.argv[2];
if (mode !== 'pull' && mode !== 'push') {
  console.error('Использование: node scripts/admin-sync.cjs pull|push');
  process.exit(1);
}
const [from, to] = mode === 'pull' ? [ADMIN_ROOT, ROOT] : [ROOT, ADMIN_ROOT];
if (!fs.existsSync(from)) {
  console.error(`Нет папки ${from}${mode === 'pull' ? ' — задайте LUSTRE_ADMIN_DIR' : ''}`);
  process.exit(1);
}

let copied = 0;
for (const rel of PATHS) {
  const src = path.join(from, rel);
  if (!fs.existsSync(src)) {
    console.warn(`  пропуск: нет ${rel}`);
    continue;
  }
  const dst = path.join(to, rel);
  // Папку заменяем целиком, чтобы удалённые файлы не оставались
  if (fs.statSync(src).isDirectory()) fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, filter: (f) => path.basename(f) !== '.gitkeep' });
  // .gitkeep держит пустую папку в открытом коде — не теряем его при замене папки
  if (mode === 'pull' && rel === 'src/app/admin') fs.writeFileSync(path.join(dst, '.gitkeep'), '');
  copied++;
  console.log(`  ${rel}`);
}
console.log(`${mode === 'pull' ? 'Админка подключена' : 'Админка сохранена в приватный репозиторий'}: ${copied} из ${PATHS.length}`);
