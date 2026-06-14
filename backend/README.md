# German Tracker — Backend

Thin FastAPI backend that holds the Anthropic API key and proxies:

- `POST /grade` — grade a spoken German translation (translation drills). Structured verdict.
- `POST /conversation` — continue a German conversation + return errors in the user's message.
- `POST /transcribe` — German speech-to-text (stub; wire up Whisper or a provider).
- `GET  /health` — liveness + whether an API key is configured.

Persistence (SQLite, stdlib `sqlite3` — no external deps):

- `GET  /state` — full snapshot (cards, attempts, error_patterns); the frontend hydrates from this.
- `POST /cards`, `PUT /cards/{id}`, `POST /cards/bulk` — create/update cards (bulk used for
  first-run seeding and conversation-spawned drills).
- `POST /attempts` — append an attempt.
- `PUT  /error-patterns/{category}` — upsert an aggregated error pattern.

The DB file defaults to `german_tracker.db` (override with `DB_PATH`). FSRS scheduling runs on
the frontend (ts-fsrs); the computed scheduler state is stored per-card as an opaque JSON blob.

## Capture inbox (add sentences from other devices)

- `POST /inbox/import` — pulls new rows from a published Google Sheet CSV into the card store.

Set up a Google Sheet as a capture inbox so you can jot down sentences from anywhere
(work laptop, phone) and have them appear in the app at home:

1. Make a sheet — **column A = English** (required), **column B = German** (optional —
   left blank, the app generates a reference translation once with the cheap model on
   import). A header row is fine; it's auto-skipped.
2. **File → Share → Publish to web → pick the sheet + "Comma-separated values (.csv)" →
   Publish**, and copy the link. (Note: publishing makes that sheet publicly readable by
   anyone who has the URL — fine for practice sentences, not for anything private.)
3. Put the link in `.env` as `GSHEET_CSV_URL=...` and restart the backend.

New rows are imported when the app loads and when you click **Sync sheet** on the Translate
screen. Import is idempotent (dedupes by English text), so re-importing the same sheet is safe.

Grading and conversation share one error model (`ErrorInstance`) so both modes can feed a
single error/vocab store, per the design.

## Setup (uv)

```powershell
cd backend
uv sync
Copy-Item .env.example .env   # then edit .env and add your ANTHROPIC_API_KEY
uv run uvicorn app.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

## Notes

- Model defaults to `claude-opus-4-8` (most capable) for grading and conversation. Override
  `CONVERSATION_MODEL=claude-haiku-4-5` in `.env` for cheaper/faster chat turns.
- The grader runs a cheap exact-match pre-check before calling Claude, so trivially-correct
  answers cost nothing.
- `/transcribe` is intentionally a 501 stub until a German STT engine is connected.
