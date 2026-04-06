# Event Timing Game (MVP)

Рабочий прототип игры на точность тайминга: пользователь смотрит видео и должен нажать кнопку максимально близко к моменту события.

Проект сделан как MVP без переусложнения архитектуры.

## Что реализовано

- 2 игровых режима: `Футбол` и `CS2`.
- Сценарий с несколькими событиями в одном видео.
- Поддержка разных типов кликов в CS2:
  - `frag (max + 50)`
  - `headshot (max + 100)`
- Подсчет очков по точности попадания (раньше/позже события).
- Логика пропусков: если событие не нажато вовремя - `пропуск (очки: 0)`.
- Отмена выбора повторным кликом по той же кнопке (до наступления события).
- Лидерборд по сумме очков, выделение текущего игрока.
- Опциональная калибровка задержки пользователя.
- Повтор раунда без рейтинга: `Повторить (без рейтинга)`.
- Базовая устойчивость к сбоям сети/Supabase в API.

## Важно про MVP scope

В MVP **осознанно не добавлялись**:

- live sports APIs
- CV/OCR и авто-распознавание событий
- массовые multiplayer-комнаты
- сложный anti-cheat
- low-level HLS sync
- Kafka/BullMQ/микросервисы
- Bun только ради performance
- Supabase Edge Functions, если можно проще

## Стек

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Next.js API routes
- Supabase (PostgreSQL)

## Структура проекта

```
app/
  api/
    submissions/
    leaderboard/
    check-submission/
    player-progress/
  game/
  layout.tsx
  page.tsx
lib/
  scoring.ts
  supabase.ts
public/
  demo.mp4
  demo2.mp4
supabase-schema.sql
```

## Запуск локально

### 1) Требования

- Node.js 18+
- npm или pnpm
- Supabase проект

### 2) Установка зависимостей

```bash
npm install
```

или

```bash
pnpm install
```

### 3) Переменные окружения

Создайте `.env.local` (можно скопировать из `.env.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 4) Инициализация БД

Примените SQL из файла:

`supabase-schema.sql`

в SQL Editor вашего Supabase проекта.

### 5) Видео

Проверьте, что в `public/` есть:

- `demo.mp4`
- `demo2.mp4`

### 6) Запуск dev-сервера

```bash
npm run dev
```

Откройте: `http://localhost:3000/game`

## Как работать с проектом

### Добавить/изменить тайминги событий

Нужно синхронно изменить 3 места:

1. `app/game/page.tsx` - клиентские таймкоды
2. `app/api/submissions/route.ts` - серверные таймкоды
3. `supabase-schema.sql` - seed значения

### Настроить скоринг

Файл: `lib/scoring.ts`

- `SCORE_PROFILES` - очки по окнам отклонения
- `EVENT_GRACE_MS_BY_GAME` - окно допуска после события

### Что проверять после изменений

```bash
npm run lint
npx tsc --noEmit
```

И руками в браузере:

- переключение режимов
- прохождение всех событий
- корректность пропусков
- отображение суммы очков
- поведение `Повторить (без рейтинга)`

## Deployment

Проект готов к деплою на Vercel:

1. Подключить репозиторий
2. Добавить env-переменные
3. Задеплоить

## Ссылки

- Прототип: `https://healthfull-omega.vercel.app`
- GitHub: `<добавьте ссылку на репозиторий>`
