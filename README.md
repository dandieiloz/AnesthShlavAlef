# Anesthesia Study (הרדמה — שלב א׳)

Hebrew/RTL MCQ learning platform for anesthesia residents. Next.js 16 + Prisma + Neon Postgres (pgvector) + NextAuth (Google) + Gemini (RAG).

## Architecture
- **RAG over textbook**: ingest each chapter PDF → 1800-char chunks → `gemini-embedding-001` (1536-d via MRL) → pgvector. Per question, retrieve top-8 chunks from that chapter and pass as the only allowed source to `gemini-2.5-pro`. System prompt forbids external knowledge.
- **Cache forever**: `GeminiAnswer` is 1:1 with `Question`; one Gemini call per question, regenerable only by admin.
- **Roles**: `USER` (default) / `ADMIN` (set manually via Prisma Studio).

## Setup
1. `cp .env.example .env` and fill in:
   - Neon `DATABASE_URL` / `DIRECT_URL` (create project, enable pgvector with `CREATE EXTENSION IF NOT EXISTS vector;`).
   - `AUTH_SECRET` (`openssl rand -base64 32`), Google OAuth client → `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.
   - `GEMINI_API_KEY` from Google AI Studio.
2. `npm install`
3. `npx prisma migrate dev --name init` (this creates tables; pgvector extension must already exist on the DB).
4. `npm run db:seed` — populates the 85 chapters.
5. `npm run dev` → http://localhost:3000

## Promote yourself to admin
After signing in once: `npm run db:studio` → `User` table → change your `role` to `ADMIN`.

## Ingest a chapter PDF
Place chapter PDFs in `textbook/`, then:
```
npm run ingest -- 10 textbook/ch10.pdf
```
This is the only Gemini call billed during ingestion (cheap — one embedding per ~1800 chars). Re-running replaces existing chunks for that chapter.

## Per-question generation
Admin → Chapter → New question (paste stem + 4 options) → "חולל הסבר עם Gemini". One billed call, cached in `GeminiAnswer.rawMarkdown`. Subsequent users see the cached answer.

## Routes
- `/` landing
- `/study` chapter picker + quiz builder
- `/quiz/[id]` quiz player (one Q at a time, reveal + comments + report)
- `/dashboard` stats per chapter
- `/admin` chapter list
- `/admin/chapters/[n]/questions` question CRUD
- `/history/[id]` question page (shared): users see the answer + explanation; admins additionally get edit + generate/regenerate explanation and management tools
- `/admin/reports` open answer-correctness reports

## Costs (rough)
- Embedding the full textbook (~5k chunks): one-time ≈ $1–2.
- Per question generation: ~8 chunks × ~500 tokens + question + completion ≈ ~$0.01.
- pgvector storage on Neon free tier: comfortably fits all chapters.

## Deploy to Firebase Hosting (Next.js SSR)
1. Install dependencies: `npm install`
2. Login to Firebase: `npm run firebase:login`
3. Enable framework support once on your machine:
   - `npx firebase-tools experiments:enable webframeworks`
4. Initialize Firebase project binding (choose existing/new Firebase project):
   - `npx firebase-tools use --add`
5. Set production env vars in your local shell before deploy (or in CI):
   - `DATABASE_URL`, `DIRECT_URL`
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`
   - `GEMINI_API_KEY`, `GEMINI_GENERATION_MODEL`, `GEMINI_EMBEDDING_MODEL`
6. Apply DB migrations against production DB:
   - `npx prisma migrate deploy`
7. Deploy:
   - `npm run firebase:deploy`

After deploy, update Google OAuth redirect URI to:
- `https://<your-firebase-domain>/api/auth/callback/google`
