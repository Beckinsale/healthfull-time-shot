🧠 Event Timing Game — FINAL PLAN (MVP, Agent-Ready)

---

1. Цель проекта
   Создать рабочий веб-прототип игры, в которой:
   • пользователь смотрит видео
   • пользователь нажимает кнопку в момент события
   • система определяет точность попадания
   • начисляются очки
   • результат сохраняется
   • отображается leaderboard
   Это демонстрационный MVP, а не production-система.

---

2. Главный принцип
   Сначала рабочий end-to-end flow → потом улучшения
   Если возникает выбор:
1. Рабочий flow
1. Красивая архитектура
   👉 всегда выбирать рабочий flow

---

3. Жёсткие ограничения (НЕ ДЕЛАТЬ)
   Запрещено добавлять:
   • AI / CV / OCR
   • live sports API
   • Redis
   • Kafka
   • BullMQ
   • WebSockets (если не критично)
   • HLS sync
   • ProgramDateTime
   • микросервисы
   • сложную авторизацию
   • production scaling
   • Bun ради скорости

---

4. Технологический стек (фиксированный)
   • Next.js (App Router)
   • TypeScript
   • Tailwind CSS
   • Supabase (Postgres)
   • Деплой: Vercel

---

5. Demo seed (ОБЯЗАТЕЛЬНО)
   Видео
   Использовать локальный файл:
   /public/demo.mp4
   Если отсутствует:
   • создать placeholder или добавить файл вручную
   Событие
   • event_time_ms = 14500
   • label = "Goal"
   • event_type = "goal"
   ⚠️ Агент НЕ должен сам выбирать видео

---

6. Игровая логика
   При клике:
   guessed_time_ms = video.currentTime \* 1000
   delta_ms = Math.abs(guessed_time_ms - event_time_ms)
   Score
   • ≤ 300 ms → 100
   • ≤ 1000 ms → 70
   • ≤ 2000 ms → 40
   • ≤ 5000 ms → 10
   • иначе → 0

---

7. Модель данных
   games
   • id
   • title
   • video_url
   events
   • id
   • game_id
   • event_time_ms
   • label
   submissions
   • id
   • game_id
   • event_id
   • player_name
   • guessed_time_ms
   • delta_ms
   • score
   • created_at

---

8. UX требования
   8.1 Ввод имени (ОБЯЗАТЕЛЬНО)
   Поведение:
1. При первом заходе:
   o показать input: "Your name"
   o кнопка "Start"
1. После ввода:
   o сохранить в localStorage
   o разблокировать игру
1. При повторном заходе:
   o автоматически подставлять имя

---

8.2 Game screen
Должен содержать:
• video player (HTML5)
• кнопка "Guess now"
• результат
• leaderboard

---

8.3 После клика
• кнопка блокируется
• показывается:
o guessed time
o delta
o score

---

9. Работа с видео
   Использовать:
   HTML5 video:
   video.currentTime
   НЕ использовать:
   • YouTube без API
   • смешанные решения

---

10. Ограничение попыток
    Клиент
    • после клика кнопка disabled
    • сохранять флаг в localStorage
    Сервер (ОБЯЗАТЕЛЬНО)
    Проверять:
    • player_name + event_id
    Если уже есть:
    • HTTP 409 Conflict
    • message: "Already submitted"

---

11. Архитектура
    Использовать монолитный подход:
    • Next.js frontend + API
    • Supabase как база
    • без отдельных сервисов

---

12. API
    Получить игру
    • game + event
    Сабмит
    Вход:
    • player_name
    • guessed_time_ms
    Логика:
    • считать delta
    • считать score
    • сохранить
    Выход:
    • результат

---

Leaderboard
• получить submissions
• сортировать:
o score DESC
o delta ASC

---

13. Порядок реализации (ФАЗЫ)

---

🔹 Phase 1 — Project Setup
Цель:
Запустить каркас приложения
Сделать:
• Next.js проект
• Tailwind
• структура папок
• routes:
o /
o /game
Результат:
Пустое приложение работает

---

🔹 Phase 2 — UI Skeleton (без БД)
Цель:
Собрать экран игры
Сделать:
• страница игры
• video блок (mock или реальный)
• кнопка Guess
• блок результата
• блок leaderboard (пока пустой)
Результат:
UI готов

---

🔹 Phase 3 — Видео + захват времени
Цель:
Получать время клика
Сделать:
• подключить /public/demo.mp4
• получить video.currentTime
• выводить время при клике
Результат:
Время фиксируется корректно

---

🔹 Phase 4 — Scoring logic
Цель:
Реализовать игровую механику
Сделать:
• добавить event_time_ms
• считать delta
• считать score
• отображать результат
Результат:
Игра работает локально

---

🔹 Phase 5 — Database (Supabase)
Цель:
Добавить persistence
Сделать:
• создать таблицы
• seed game + event
• подключить Supabase
• сохранять submissions
⚠️ Важно:
Supabase создаётся вручную до запуска
Env:
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
Результат:
Данные сохраняются

---

🔹 Phase 6 — Leaderboard
Цель:
Сделать соревнование
Сделать:
• получать submissions
• сортировать
• выводить top 10
Результат:
Leaderboard работает

---

🔹 Phase 7 — Ограничение попыток
Цель:
Сделать честную механику
Сделать:
• блокировать кнопку
• localStorage
• серверная проверка (409)
Результат:
Нельзя отправить дважды

---

🔹 Phase 8 — UX polish
Сделать:
• loading states
• error states
• disabled states
• аккуратный UI
Результат:
Приложение выглядит законченно

---

🔹 Phase 9 — Deploy
Сделать:
• деплой на Vercel
• подключить env
• проверить flow
Результат:
Есть рабочая ссылка

---

14. Definition of Done
    MVP готов, если:
    • видео воспроизводится
    • клик фиксируется
    • delta считается
    • score считается
    • данные сохраняются
    • leaderboard работает
    • повторный клик невозможен
    • UI понятен
    • есть деплой

---

15. Анти-цель
    Проект НЕ должен стать:
    • платформой аналитики
    • системой ставок
    • AI-платформой
    • streaming-инфраструктурой

---

16. Правило принятия решений
    Если есть сомнение:
    Делай проще.

---

🔚 Итог
Теперь это:
✅ исполняемый план
✅ без дыр
✅ без неопределённостей
✅ безопасный для агента
✅ ведёт к реальному MVP
