"""Pydantic models shared across the API.

These mirror the data model agreed during design: the grader emits a structured
verdict with categorized errors, which the client folds into the Card / Attempt /
ErrorPattern store.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field

Grade = Literal["correct", "minor", "wrong"]
ErrorCategory = Literal[
    "case",
    "word-order",
    "preposition",
    "gender",
    "verb-conjugation",
    "adjective-ending",
    "vocabulary",
    "anglicism",
    "spelling",
    "other",
]


class ErrorInstance(BaseModel):
    category: ErrorCategory
    span_de: str = Field(description="The exact incorrect German fragment the learner said.")
    correction: str = Field(description="What that fragment should have been.")
    explanation: str = Field(description="One short sentence on why, in English.")


class GradeRequest(BaseModel):
    prompt_en: str = Field(description="The English sentence the learner was asked to translate.")
    spoken_de: str = Field(description="The learner's German answer (raw STT transcript).")
    target_de: str | None = Field(
        default=None, description="Reference/canonical German translation, if known."
    )
    acceptable_de: list[str] = Field(
        default_factory=list, description="Other accepted German variants."
    )
    asr_confidence: float | None = Field(
        default=None, description="Speech-to-text confidence 0..1, if available."
    )
    context_note: str | None = Field(
        default=None, description="Register/context hint, e.g. 'formal', 'to a landlord'."
    )


class GradeResult(BaseModel):
    grade: Grade
    is_acceptable_variant: bool = Field(
        description="True if the answer is valid German even though it differs from the reference."
    )
    likely_asr_error: bool = Field(
        description="True if the apparent mistake is probably a transcription error, not a real one."
    )
    errors: list[ErrorInstance] = Field(default_factory=list)
    coaching: str = Field(description="1-2 sentences of encouraging, pattern-level feedback.")
    better_phrasing: str | None = Field(
        default=None, description="An optionally more natural alternative phrasing."
    )


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ConversationRequest(BaseModel):
    history: list[ConversationTurn] = Field(default_factory=list)
    user_message: str
    scenario: str | None = Field(
        default=None, description="Optional roleplay scenario, e.g. 'complaining to a landlord'."
    )
    correction_mode: Literal["inline", "end-of-turn"] = "end-of-turn"


class DrillSuggestion(BaseModel):
    """A self-contained translation drill spawned from a conversation mistake.

    This is what closes the loop: a mistake made while speaking becomes a card that
    resurfaces in translation drills (spaced repetition).
    """

    prompt_en: str = Field(description="A short, standalone English sentence to translate.")
    target_de: str = Field(description="The correct German translation of prompt_en.")
    tags: list[str] = Field(
        default_factory=list, description="Grammar/topic tags, e.g. ['Dativ', 'preposition']."
    )


# Conversation is split into two calls so the reply isn't blocked by the analysis:
#   1. /conversation/reply    — fast, streamed German reply.
#   2. /conversation/feedback — background error analysis + drill generation.


class ConversationReplyRequest(BaseModel):
    history: list[ConversationTurn] = Field(default_factory=list)
    user_message: str
    scenario: str | None = None


class ConversationFeedbackRequest(BaseModel):
    user_message: str
    scenario: str | None = None
    history: list[ConversationTurn] = Field(default_factory=list)


class ConversationFeedback(BaseModel):
    errors: list[ErrorInstance] = Field(
        default_factory=list, description="Errors found in the user's latest message."
    )
    coaching: str | None = Field(
        default=None, description="Optional pattern-level feedback on the user's message."
    )
    drills: list[DrillSuggestion] = Field(
        default_factory=list,
        description="0-3 drill cards targeting the user's mistakes, for spaced repetition.",
    )


class TranscribeResult(BaseModel):
    transcript: str
    confidence: float | None = None


# ── Persistence models (wire shapes match the frontend store) ─────────────────


class CardModel(BaseModel):
    id: str
    type: str
    source: str
    prompt_en: str
    target_de: str | None = None
    acceptable_de: list[str] = Field(default_factory=list)
    context_note: str | None = None
    tags: list[str] = Field(default_factory=list)
    createdAt: str
    archived: bool = False
    fsrs: dict[str, Any]  # opaque ts-fsrs Card state


class AttemptModel(BaseModel):
    id: str
    cardId: str
    timestamp: str
    mode: str
    spoken_de: str
    grade: str
    errorCount: int = 0


class ErrorExample(BaseModel):
    span_de: str
    correction: str


class ErrorPatternModel(BaseModel):
    category: str
    count: int
    lastSeen: str
    examples: list[ErrorExample] = Field(default_factory=list)


class StateResponse(BaseModel):
    cards: list[CardModel]
    attempts: list[AttemptModel]
    error_patterns: list[ErrorPatternModel]
