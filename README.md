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
