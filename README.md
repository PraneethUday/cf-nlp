## CF Insights (Next.js + TypeScript)

Prereqs: Node 18+.

1. Copy .env.example to .env.local and fill keys
2. Install deps: `pnpm i` (or `npm i`/`yarn`)
3. Dev: `pnpm dev`

Environment variables
- CF_KEY=
- CF_SECRET=
- GEMINI_API_KEY=

Notes
- Codeforces API signing implemented per `cf-api.txt` (SHA-512 over sorted params).
- Calls go through `/api/cf/*` to avoid exposing secrets and handle rate limits.

