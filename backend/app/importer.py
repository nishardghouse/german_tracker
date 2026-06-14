"""Import sentences captured in a published Google Sheet (CSV) into the card store.

This is the "add sentences from anywhere" path: keep a Google Sheet, add a row whenever
you come across a sentence (from any device), and the home app pulls new rows into
german_tracker.db. No Google API/credentials — the sheet is published to the web as CSV
and fetched over plain HTTP.

Sheet format: column A = English (required), column B = German reference (optional — when
blank, a reference translation is generated once with the cheap model). A header row is
detected and skipped. Import is idempotent — rows whose English already exists as a card
are skipped, so re-importing the same sheet does nothing (and won't re-translate).
"""

import csv
import io
import re
import uuid
from datetime import datetime, timezone

import httpx

from . import llm, repository
from .config import get_settings
from .schemas import CardModel

_HEADER_CELLS = {"english", "sentence", "en", "prompt", "prompt_en", "englisch"}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", s.lower(), flags=re.UNICODE)).strip()


def _empty_fsrs(now_iso: str) -> dict:
    """A fresh ts-fsrs card (New state). The frontend fills any version-specific fields."""
    return {
        "due": now_iso,
        "stability": 0,
        "difficulty": 0,
        "elapsed_days": 0,
        "scheduled_days": 0,
        "reps": 0,
        "lapses": 0,
        "state": 0,
    }


def import_from_sheet() -> int:
    """Fetch the configured CSV, insert any new sentences as cards, return the count added."""
    url = get_settings().gsheet_csv_url.strip()
    if not url:
        return 0

    resp = httpx.get(url, timeout=10.0, follow_redirects=True)
    resp.raise_for_status()
    rows = list(csv.reader(io.StringIO(resp.text)))

    existing = {_norm(c.prompt_en) for c in repository.get_state().cards}
    now = datetime.now(timezone.utc).isoformat()
    new_cards: list[CardModel] = []

    for idx, row in enumerate(rows):
        if not row:
            continue
        prompt_en = (row[0] or "").strip()
        target_de = (row[1].strip() if len(row) > 1 and row[1] else "")
        key = _norm(prompt_en)
        if not key:
            continue
        if idx == 0 and key in _HEADER_CELLS:  # skip a header row
            continue
        if key in existing:
            continue
        existing.add(key)

        # Auto-generate a reference translation when the sheet leaves German blank.
        if not target_de:
            try:
                target_de = llm.translate_en_to_de(prompt_en)
            except Exception as e:  # API key missing / call failed — import without a reference
                print(f"[importer] translation failed for {prompt_en!r}: {e}")
                target_de = ""

        new_cards.append(
            CardModel(
                id=uuid.uuid4().hex,
                type="sentence",
                source="inbox",
                prompt_en=prompt_en,
                target_de=target_de or None,
                acceptable_de=[target_de] if target_de else [],
                tags=[],
                createdAt=now,
                archived=False,
                fsrs=_empty_fsrs(now),
            )
        )

    if new_cards:
        repository.upsert_cards(new_cards)
    return len(new_cards)
