# CareerOS

CareerOS is a local AI Career CRM for planning a careful search for a quality employer.

The app runs on your computer, stores your data locally, and opens in a browser. MVP-1 is a safe CRM foundation: AI setup, resume text input, AI resume analysis, and creation of the first search profile from that resume.

## Public Repository Safety

This repository is public and must not contain user data.

Do not commit real resumes, personal data, API keys, local SQLite databases, AI memory files, vacancy exports, employer data, browser profiles, or local app storage. Real resumes, keys, the database, and memory stay local and are ignored by git.

CareerOS does not send applications automatically and does not automate hh in MVP-1.

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
npx prisma migrate dev --name init
npm run dev
```

PowerShell migration command if Prisma CLI does not pick up `.env.local`:

```powershell
$env:DATABASE_URL="file:./dev.db"; npx prisma migrate dev --name init
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
```

## MVP-1 Scope

- Local dashboard and onboarding wizard.
- OpenAI-compatible AI settings test.
- Resume text input and AI analysis.
- First search profile created only from the user's resume analysis.
- Empty CRM sections for vacancies, companies, applications, and AI memory.

Out of scope for MVP-1: hh parsing, vacancy collection, employer verification, PDF/DOCX resume upload, and automatic application sending.
