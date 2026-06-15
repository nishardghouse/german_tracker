from fastapi import APIRouter

from .. import repository
from ..llm import translate_en_to_de
from ..schemas import AttemptModel, CardModel, ErrorPatternModel, StateResponse, TranslateRequest, TranslateResponse

router = APIRouter(tags=["data"])


@router.get("/state", response_model=StateResponse)
def get_state() -> StateResponse:
    """Full store snapshot — the frontend hydrates its in-memory cache from this once."""
    return repository.get_state()


@router.post("/cards", status_code=204)
def create_card(card: CardModel) -> None:
    repository.upsert_card(card)


@router.put("/cards/{card_id}", status_code=204)
def update_card(card_id: str, card: CardModel) -> None:
    card.id = card_id
    repository.upsert_card(card)


@router.post("/cards/bulk", status_code=204)
def create_cards(cards: list[CardModel]) -> None:
    """Bulk insert/update — used for first-run seeding and conversation-spawned drills."""
    repository.upsert_cards(cards)


@router.post("/attempts", status_code=204)
def create_attempt(attempt: AttemptModel) -> None:
    repository.insert_attempt(attempt)


@router.put("/error-patterns/{category}", status_code=204)
def upsert_error_pattern(category: str, pattern: ErrorPatternModel) -> None:
    pattern.category = category
    repository.upsert_error_pattern(pattern)


@router.post("/translate", response_model=TranslateResponse)
def translate(body: TranslateRequest) -> TranslateResponse:
    return TranslateResponse(translation=translate_en_to_de(body.text))
