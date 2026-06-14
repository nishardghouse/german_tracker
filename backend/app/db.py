"""SQLite persistence — stdlib `sqlite3` only, no external dependencies.

The backend is the source of truth for the learning data (cards, attempts, error
patterns). FSRS scheduling stays on the frontend (ts-fsrs); the computed scheduler
state is stored here as an opaque JSON blob on each card.
"""

import sqlite3
from contextlib import contextmanager
from collections.abc import Iterator

from .config import get_settings


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(get_settings().resolved_db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS cards (
                id            TEXT PRIMARY KEY,
                type          TEXT NOT NULL,
                source        TEXT NOT NULL,
                prompt_en     TEXT NOT NULL,
                target_de     TEXT,
                acceptable_de TEXT NOT NULL DEFAULT '[]',  -- JSON array
                context_note  TEXT,
                tags          TEXT NOT NULL DEFAULT '[]',  -- JSON array
                created_at    TEXT NOT NULL,
                archived      INTEGER NOT NULL DEFAULT 0,
                fsrs          TEXT NOT NULL                 -- JSON object (ts-fsrs Card)
            );

            CREATE TABLE IF NOT EXISTS attempts (
                id          TEXT PRIMARY KEY,
                card_id     TEXT NOT NULL,
                timestamp   TEXT NOT NULL,
                mode        TEXT NOT NULL,
                spoken_de   TEXT NOT NULL,
                grade       TEXT NOT NULL,
                error_count INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS error_patterns (
                category   TEXT PRIMARY KEY,
                count      INTEGER NOT NULL DEFAULT 0,
                last_seen  TEXT NOT NULL,
                examples   TEXT NOT NULL DEFAULT '[]'       -- JSON array
            );
            """
        )
