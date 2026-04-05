# Следующие шаги для запуска

## Текущий статус
✅ Код готов (9 фаз завершены)
✅ Демо-видео добавлено (13.35 сек)
✅ Событие настроено на 10 секунд
⚠️  Supabase не настроен

## Для полного запуска нужно:

### 1. Настроить Supabase (5 минут)

1. Перейти на https://supabase.com
2. Создать новый проект
3. Дождаться создания (1-2 минуты)
4. SQL Editor → Вставить содержимое `supabase-schema.sql` → Run
5. Settings → API → Скопировать:
   - Project URL
   - anon/public key

### 2. Создать .env.local

```bash
cd healthfull
cat > .env.local << 'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=ваш_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_anon_key
ENVEOF
```

### 3. Запустить приложение

```bash
pnpm dev
```

Откройте http://localhost:3000

## Тестирование без Supabase

Можно протестировать UI без БД:
- ✅ Видео будет работать
- ✅ Score будет считаться локально
- ❌ Leaderboard не загрузится
- ❌ Сохранение не будет работать

## Быстрый тест сейчас

```bash
cd healthfull
pnpm dev
```

1. Откройте http://localhost:3000
2. Кликните "Start Game"
3. Введите имя
4. Посмотрите видео
5. Кликните "Guess Now!" примерно на 10-й секунде
6. Увидите результат локально

## Deploy на Vercel

После настройки Supabase:

```bash
vercel
# Добавьте env переменные в dashboard
vercel --prod
```

Полная инструкция: `DEPLOYMENT.md`
