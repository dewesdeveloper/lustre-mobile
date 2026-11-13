# Lustre Mobile

Android-клиент Lustre: каталог и страницы игр с отзывами, библиотека, друзья, чаты,
звонки (LiveKit), сообщества с голосовыми каналами, магазин кастомизации, поддержка.

Сервер (API) — отдельный закрытый проект; клиент работает с ним по адресу из
`EXPO_PUBLIC_API_URL`.

## Стек

Expo SDK 57, React Native 0.86, Expo Router (экраны в `src/app/`), TypeScript.
Звонки и голосовые каналы — `@livekit/react-native`, поэтому приложение не запускается в
Expo Go: нужна dev-сборка.

## Админ-панель

Экраны админки (`src/app/admin/`, `src/components/admin/`, `src/api/admin.ts`) — закрытый
модуль, в открытый код не входит; без него приложение собирается и работает, пункта
«Админ-панель» в профиле просто нет. Официальная сборка подтягивает модуль из приватного
репозитория: `npm run admin:pull` (путь — `LUSTRE_ADMIN_DIR`, по умолчанию `../LustreAdmin`).
Сборка в EAS берёт файлы по `.easignore`, поэтому подключённый модуль уходит в APK.

## Сборка

```bash
npm install
npx expo run:android      # dev-сборка на подключённом телефоне или эмуляторе
npx tsc --noEmit          # проверка типов
npm run lint
```

APK через EAS:

```bash
npx eas-cli build --platform android --profile preview
```

Для своей сборки в EAS замените `owner` и `extra.eas.projectId` в `app.json` на свои.

### Адрес сервера

`EXPO_PUBLIC_API_URL` из `.env` попадает в сборку (сейчас — сервер проекта
`https://api.lustrehub.pro`). Шаблон — `.env.example`.

## Лицензия

Copyright © 2026 DewesDeveloper.

Lustre Mobile распространяется на условиях **GNU General Public License v3.0 или более
поздней версии** — см. [LICENSE](LICENSE). Сторонние компоненты идут под своими лицензиями —
см. [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt). Названия и логотипы Lustre — не часть
лицензии GPL.
