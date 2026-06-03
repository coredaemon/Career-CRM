# CareerOS

CareerOS is a local AI Career CRM for planning a careful search for a quality employer.

The app runs on your computer, stores your data locally, and opens in a browser. The public repository must not contain user data, real resumes, API keys, SQLite databases, browser profiles, vacancy exports, employer data, AI memory files, or local app storage.

CareerOS does not send applications automatically, does not store hh login/password, does not bypass captchas, and does not automate hh responses. The user opens hh and sends applications manually.

## Current Workflow

- Upload a resume as text or PDF with a text layer.
- Review and edit extracted resume text.
- Add confirmed facts that AI is allowed to use in cover letters.
- Analyze the resume and create a search profile.
- Run a browser-based hh vacancy search from the search profile.
- Watch live progress in the app: current query, collected links, saved vacancies, duplicates, AI analysis, errors, and run log.
- Save collected vacancies in the local CRM.
- Analyze new vacancies with AI using the configured analysis/writer providers.
- Open recommended vacancies, copy cover letters, and apply manually on hh.
- Mark applications as sent and let CareerOS schedule a follow-up check.

## Public Repository Safety

This repository is public and must not contain user data.

Do not commit real resumes, personal data, API keys, local SQLite databases, AI memory files, vacancy exports, employer data, browser profiles, uploaded PDFs, or local app storage. Real resumes, keys, the database, browser profile, uploads, logs, and memory stay local and are ignored by git.

## Getting Started

Copy the example environment file before the first run:

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Fill in `.env.local` with your local AI provider settings. The API key is never committed and should not be pasted into public issues or pull requests.

Install dependencies and prepare Prisma:

```bash
npm install
npx prisma migrate dev
```

PowerShell migration command if Prisma CLI does not pick up `.env.local`:

```powershell
$env:DATABASE_URL="file:./dev.db"; npx prisma migrate dev
```

For hh browser search, install Chromium for Playwright:

```bash
npx playwright install chromium
```

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Vacancy Search

1. Open `Поиск вакансий`.
2. Choose a search profile.
3. Enable the generated search queries or add your own queries.
4. Set conservative limits, for example 10 vacancies per query and 50 per run.
5. Start the search and watch the live log in the app.
6. If hh asks for login, complete it manually in the opened browser.
7. If hh shows captcha or a protection page, CareerOS stops the run and records the reason.

After the run finishes, use:

- `Открыть все найденные` to review collected vacancies.
- `Проанализировать непроанализированные` if AI was off or failed.
- `Открыть рекомендованные` to start manual applications.
- `Детали запуска` to inspect log, errors, duplicates, and saved vacancies.

If the search found nothing, try broader queries, a different region, or a smaller set of filters.

If AI analysis did not run, check `Настройки AI`, then use `Проанализировать непроанализированные` on the vacancies page. CareerOS keeps the vacancy even when AI fails and marks it for review.

## Progress and Long-Running Tasks

### How to tell that search is running

- On `Поиск вакансий`, the progress panel shows the current stage, query number, counters, and a live log while the run is active.
- The left menu indicator shows `Идёт поиск` when a search is running.
- Open `Процессы` or `Детали запуска` (`/search/runs/[id]`) to see polling-based updates even if the browser stream was interrupted.

### Bulk AI analysis progress

- `Проанализировать непроанализированные` opens a mode picker:
  - **Быстрый анализ** — score, red flags, recommendation only (no cover letters, no reviewer). Default for bulk and post-search AI.
  - **Полный анализ** — analysis, reviewer for borderline scores, writer for every vacancy (slow, more tokens).
  - **Только письма для рекомендованных** — writer only for `ai_recommended` / `ready_to_apply` without a letter.
- Progress uses one counter everywhere (sidebar, `/processes`, `/vacancies`, `/processes/[id]`): `N из M`, elapsed time, and ETA when at least two vacancies finished.
- Stop: `Остановить после текущей вакансии` on `/vacancies`, bulk button, or **Остановить процесс** on `/processes/[id]`. Bulk actions on `/processes`: stop all AI, stop all searches, mark stale as stopped, hide completed runs from the list (data kept).
- Only one `vacancy_analysis` run at a time; the analyze button is disabled while another run is active.
- **Скорость и диагностика** on `/processes/[id]`: time per AI role, retries, invalid JSON count, timeouts, last model call.

### Why AI analysis can take long

- Vacancies are processed **one at a time** (safer for rate limits and SQLite).
- Each vacancy may call: DeepSeek (analysis, up to 3 JSON retries), optional reviewer, optional OpenAI writer.
- A single call can take up to **90 seconds** before `AI_TIMEOUT`; the vacancy is saved with `analysis_error` and the run continues.
- Post-search AI uses **fast** mode by default (no letters for all 50 vacancies). Generate letters later via **Только письма для рекомендованных** or full mode if you explicitly choose it.

### Stale or stuck processes

If a run stays in `Выполняется` for more than 10 minutes without updates, CareerOS marks it as `Завис` on the next page load.

Actions:

- `Пометить как остановленный` on search history or run details.
- `Повторить запуск` from the search page.
- Open `Процессы` to review stale search and AI tasks.

### Invalid AI JSON

If the analyst model returns text instead of JSON, CareerOS retries up to 3 times, then saves the vacancy with `Ошибка анализа`.

On the vacancy page you will see an explanation that the model may have received garbage text (cookie banners, navigation) or failed JSON formatting, plus actions: check vacancy text, retry fast analysis, manual review, or mark as junk.

Writer and reviewer are not called when analysis JSON is invalid.

### HH service pages and invalid sources

During hh browser search, CareerOS collects links matching `/vacancy/` in the DOM. That selector can occasionally capture hh service URLs such as `/search/vacancy/advanced` instead of a real vacancy card. CareerOS now validates URLs and page content **before saving** and **before AI analysis**.

If a record is not a real vacancy:

- status becomes `Невалидный источник` (`invalid_source`)
- AI is not called (no token waste)
- the vacancy appears under **Невалидные источники** on `/vacancies`

Use **Найти мусорные вакансии** on `/vacancies` to scan existing junk and mark it safely without deleting rows.

### Recommended vacancies

After successful **fast** analysis, use **Создать письма для рекомендованных** for bulk cover letters. Full analysis adds reviewer for borderline scores; letters are still created only for recommended vacancies, not for every row in the batch.

Use `Пересчитать статистику` on run details if top counters and the vacancy list disagree.

## Manual Applications

CareerOS never sends applications automatically. The practical flow is:

1. Open `Рекомендованные`.
2. Open the vacancy on hh.
3. Copy the generated cover letter.
4. Send the application manually on hh.
5. Click `Отклик отправлен` in CareerOS.

CareerOS will create an application record and schedule `проверить ответ` in 5 days.

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Local Data

These paths are intentionally ignored:

- `.env`, `.env.local`, `.env.*.local`
- `prisma/dev.db`, `*.sqlite`, `*.sqlite3`
- `browser-profile/`
- `uploads/`
- `resumes/`
- `memory/`, `knowledge/`
- `logs/`
- `.next/`, `node_modules/`

`src/app/resumes` and `src/app/memory` are source-code routes and are not ignored.
