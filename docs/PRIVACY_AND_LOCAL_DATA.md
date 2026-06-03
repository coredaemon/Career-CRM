# Privacy and Local Data

CareerOS is local-first. Real resumes, search profiles, vacancies, companies, applications, AI memory, and logs are user data and must remain on the user's machine.

Ignored local paths include:

- `.env`, `.env.local`, `.env.*.local`
- SQLite databases
- `app_data/`
- `local_data/`
- `browser-profile/`
- `storage/`
- `uploads/`
- `resumes/`
- `memory/`
- `knowledge/`
- `exported/`
- `logs/`

## AI Requests

Resume analysis sends the pasted resume text to the configured OpenAI-compatible provider. Users should choose a provider they trust and understand its data policy.

## Public Examples

Only fake/sample data should appear in docs, tests, fixtures, screenshots, and demos.
