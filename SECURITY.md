# Security Policy

CareerOS is designed for a public repository and local private data.

## Never Commit

- Real resumes or personal data.
- `.env`, `.env.local`, or any local environment file.
- API keys or provider tokens.
- Local SQLite databases.
- `app_data/`, `local_data/`, `storage/`, `uploads/`, `resumes/`, `memory/`, `knowledge/`, or `exported/`.
- Browser profiles such as `browser-profile/`.
- Vacancy exports, employer data, or user-specific CRM records.

Use only fake or sample data in examples, tests, screenshots, and documentation.

## If a Secret Is Committed

Revoke the key immediately in the provider dashboard, remove it from the repository history, rotate any related credentials, and verify that the replacement key exists only in local ignored files.

## Local Data

CareerOS stores real user data locally. Treat the local database, memory files, resumes, logs, and exports as private user data.
