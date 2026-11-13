# Известные проблемы (KNOWN_ISSUES)

Ниже перечислены неисправленные ошибки, выявленные после прогона `vitest run` и `tsc --noEmit`.
`tsc --noEmit` проходит чисто; синтаксическая ошибка в `src/view/settingsView.js` устранена.

## 1. `tests/ui/onboardingSheet.test.js` — 4 теста падают

**Симптом:** `ReferenceError: Cannot access 'heading' before initialization`  
**Место:** `src/view/onboardingSheet.js:9` — `heading` используется до объявления `const heading` (TDZ).  
**Что починить:** перенести объявление `const heading` выше строки, где задаётся `heading.id`.

## 2. `tests/build/packaging.test.js` — 2 теста падают

**Симптом:** `AssertionError: expected ... to contain 'const CACHE_VERSION = 'schedule-pwa-BUILDSTAMP''`  
**Причина:** в `public/sw.js` `CACHE_VERSION = 'schedule-pwa-v2-BUILDSTAMP'`, тесты ожидают `'schedule-pwa-BUILDSTAMP'` (без `-v2-`).  
**Что починить:** либо привести `CACHE_VERSION` в SW к `'schedule-pwa-BUILDSTAMP'`, либо обновить ожидание в тестах на `'schedule-pwa-v2-BUILDSTAMP'`.

## 3. `tests/pwa/service-worker-behavior.test.js` — 5 тестов падают

**Симптом:** несовпадение имён кэшей (`schedule-pwa-BUILDSTAMP` vs `schedule-pwa-v2-BUILDSTAMP`), отсутствие ассетов по путям `https://user.github.io/IMF/data/...`, `Cannot read properties of undefined (reading 'get')`.  
**Причина:** та же разница версии кэша (`-v2-`), плюс пути к данным и отсутствие моков storages.  
**Что починить:** унифицировать версию кэша между SW и тестами; проверить моки `worker.stores` в сервис-воркерных тестах.

## 4. `tests/parser/no-loss.test.js` — 1 набор тестов падает

**Симптом:** `ENOENT: no such file or directory, open '...\\data\\schedule.xls'`  
**Причина:** файл переименован в `data/6 СЖ_МК_26-27_1пг_7_нед_по новому сем ММФ КУМУ (1).xls`, а тест всё ещё ищет `data/schedule.xls`.  
**Что починить:** либо создать `data/schedule.xls` (копию/ярлык), либо обновить путь в `tests/parser/no-loss.test.js` и `scripts/parser-invariants.ts`.
