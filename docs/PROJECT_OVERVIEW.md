# Project Overview

CareerOS is a local AI Career CRM for structured job search planning.

MVP-1 focuses on a safe foundation:

- Empty CRM by default.
- AI setup through OpenAI-compatible settings.
- Resume text input.
- AI analysis that derives search ideas only from the user's resume.
- User confirmation before creating the first search profile.

CareerOS does not parse hh, collect vacancies, verify employers, or send applications automatically in MVP-1.

## Architecture

- Frontend: Next.js, TypeScript, Tailwind CSS.
- Backend: Next.js route handlers.
- Database: SQLite through Prisma.
- AI: OpenAI-compatible chat completions endpoint.

## Data Principle

No real career data belongs in the public repository. User data is local and ignored by git.
