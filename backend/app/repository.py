"""Row <-> model mapping for the SQLite store."""

import json
import sqlite3

from .db import connect
from .schemas import AttemptModel, CardModel, ErrorPatternModel, StateResponse


def _row_to_card(row: sqlite3.Row) -> CardModel:
    return CardModel(
        id=row["id"],
        type=row["type"],
        source=row["source"],
        prompt_en=row["prompt_en"],
        target_de=row["target_de"],
        acceptable_de=json.loads(row["acceptable_de"]),
        context_note=row["context_note"],
        tags=json.loads(row["tags"]),
        createdAt=row["created_at"],
        archived=bool(row["archived"]),
        fsrs=json.loads(row["fsrs"]),
    )


def _row_to_attempt(row: sqlite3.Row) -> AttemptModel:
    return AttemptModel(
        id=row["id"],
        cardId=row["card_id"],
        timestamp=row["timestamp"],
        mode=row["mode"],
        spoken_de=row["spoken_de"],
        grade=row["grade"],
        errorCount=row["error_count"],
    )


def _row_to_pattern(row: sqlite3.Row) -> ErrorPatternModel:
    return ErrorPatternModel(
        category=row["category"],
        count=row["count"],
        lastSeen=row["last_seen"],
        examples=json.loads(row["examples"]),
    )


def get_state() -> StateResponse:
    with connect() as conn:
        cards = [_row_to_card(r) for r in conn.execute("SELECT * FROM cards")]
        attempts = [_row_to_attempt(r) for r in conn.execute("SELECT * FROM attempts")]
        patterns = [_row_to_pattern(r) for r in conn.execute("SELECT * FROM error_patterns")]
    return StateResponse(cards=cards, attempts=attempts, error_patterns=patterns)


def upsert_card(card: CardModel) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO cards (id, type, source, prompt_en, target_de, acceptable_de,
                               context_note, tags, created_at, archived, fsrs)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                type=excluded.type, source=excluded.source, prompt_en=excluded.prompt_en,
                target_de=excluded.target_de, acceptable_de=excluded.acceptable_de,
                context_note=excluded.context_note, tags=excluded.tags,
                archived=excluded.archived, fsrs=excluded.fsrs
            """,
            (
                card.id,
                card.type,
                card.source,
                card.prompt_en,
                card.target_de,
                json.dumps(card.acceptable_de),
                card.context_note,
                json.dumps(card.tags),
                card.createdAt,
                int(card.archived),
                json.dumps(card.fsrs),
            ),
        )


def upsert_cards(cards: list[CardModel]) -> None:
    for card in cards:
        upsert_card(card)


def insert_attempt(attempt: AttemptModel) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO attempts
                (id, card_id, timestamp, mode, spoken_de, grade, error_count)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                attempt.id,
                attempt.cardId,
                attempt.timestamp,
                attempt.mode,
                attempt.spoken_de,
                attempt.grade,
                attempt.errorCount,
            ),
        )


def upsert_error_pattern(pattern: ErrorPatternModel) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO error_patterns (category, count, last_seen, examples)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(category) DO UPDATE SET
                count=excluded.count, last_seen=excluded.last_seen, examples=excluded.examples
            """,
            (
                pattern.category,
                pattern.count,
                pattern.lastSeen,
                json.dumps([e.model_dump() for e in pattern.examples]),
            ),
        )
