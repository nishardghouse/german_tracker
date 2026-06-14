"""Claude-backed grading and conversation.

This is the part of the system that's hardest to get right, so it's isolated here:
- One Anthropic client, holding the API key server-side only.
- A cheap deterministic pre-check before spending an LLM call.
- Structured grading via messages.parse() so the verdict is validated, not parsed by hand.
"""

import re
from collections.abc import Iterator

import anthropic

from .config import get_settings
from .schemas import (
    ConversationFeedback,
    ConversationFeedbackRequest,
    ConversationReplyRequest,
    GradeRequest,
    GradeResult,
)

_client: anthropic.Anthropic | None = None


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        settings = get_settings()
        # Anthropic() also reads ANTHROPIC_API_KEY from env; we pass explicitly so a
        # value loaded from .env via pydantic-settings is always used.
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)
    return _client


def _supports_adaptive_thinking(model: str) -> bool:
    """Adaptive thinking is available on Fable 5, Opus 4.6+, and Sonnet 4.6 — but not
    on Haiku 4.5, where sending it would 400. Gate on the model so tiering is safe."""
    m = model.lower()
    return (
        "fable" in m
        or "sonnet-4-6" in m
        or any(f"opus-4-{v}" in m for v in ("6", "7", "8"))
    )


def _normalize(text: str) -> str:
    """Lowercase, collapse whitespace, strip punctuation, tolerate ß/ss."""
    text = text.lower().replace("ß", "ss")
    text = re.sub(r"[^\w\s]", "", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def _trivially_correct(req: GradeRequest) -> bool:
    """Exact/near-exact match against any accepted answer -> skip the LLM call."""
    spoken = _normalize(req.spoken_de)
    if not spoken:
        return False
    candidates = [req.target_de, *req.acceptable_de]
    return any(c and _normalize(c) == spoken for c in candidates)


GRADING_SYSTEM = """\
You are an expert German tutor grading a learner (around B2 level) who is translating \
an English sentence into spoken German. The German you receive is a speech-to-text \
transcript, so it may contain transcription artefacts.

Grading principles:
- Judge whether the answer is correct AND natural German, not whether it matches a \
reference word-for-word. Many translations are equally valid.
- If the answer is valid German that simply differs from the reference, set \
is_acceptable_variant=true and grade it on its own merits.
- If a low ASR confidence and a phonetically-close transcript suggest the learner \
probably said the right thing and the transcriber misheard, set likely_asr_error=true \
and do not count it as a real grammar mistake.
- Categorize each genuine error. Keep explanations to one short sentence.
- Coaching must be encouraging and pattern-level (name the theme, e.g. "watch Dativ \
after two-way prepositions"), not a nitpicky list.

grade values:
- "correct": fully correct and natural (minor stylistic differences are fine)
- "minor": right meaning, small slip (a wrong ending, an article)
- "wrong": meaning is off or there are multiple substantive errors
"""


def grade(req: GradeRequest) -> GradeResult:
    if _trivially_correct(req):
        return GradeResult(
            grade="correct",
            is_acceptable_variant=req.target_de is not None
            and _normalize(req.target_de) != _normalize(req.spoken_de),
            likely_asr_error=False,
            errors=[],
            coaching="Spot on — that matches a known correct answer.",
        )

    settings = get_settings()
    user_payload = (
        f"English to translate:\n{req.prompt_en}\n\n"
        f"Learner's spoken German (STT transcript):\n{req.spoken_de}\n\n"
        f"Reference translation: {req.target_de or '(none provided)'}\n"
        f"Other acceptable answers: {req.acceptable_de or '(none)'}\n"
        f"ASR confidence: {req.asr_confidence if req.asr_confidence is not None else '(unknown)'}\n"
        f"Context/register: {req.context_note or '(none)'}"
    )

    # Grading is structured, not deep reasoning — skip thinking to cut cost/latency.
    response = client().messages.parse(
        model=settings.grading_model,
        max_tokens=1500,
        system=GRADING_SYSTEM,
        messages=[{"role": "user", "content": user_payload}],
        output_format=GradeResult,
    )
    return response.parsed_output


TRANSLATE_SYSTEM = (
    "You are a translator. Translate the user's English sentence into natural, idiomatic "
    "German. Reply with ONLY the German translation — no quotes, no notes, no alternatives."
)


def translate_en_to_de(text: str) -> str:
    """Translate one English sentence to German. Cheap model, no thinking, plain text."""
    settings = get_settings()
    response = client().messages.create(
        model=settings.grading_model,
        max_tokens=256,
        system=TRANSLATE_SYSTEM,
        messages=[{"role": "user", "content": text}],
    )
    return "".join(b.text for b in response.content if b.type == "text").strip()


CONVERSATION_REPLY_SYSTEM = """\
You are a friendly German conversation partner for a learner at roughly B2 level. Hold a \
natural conversation entirely in German. Keep replies conversational and fairly short so \
the learner gets to speak. Do NOT correct the learner's mistakes here — just respond \
naturally to what they said and keep the conversation going.
"""

CONVERSATION_FEEDBACK_SYSTEM = """\
You are a German tutor reviewing a learner's latest message in a conversation. The message \
is a speech-to-text transcript, so ignore likely transcription artefacts.

Identify any genuine German errors (grammar, word choice, naturalness) and return them in \
`errors`, each categorized with a one-sentence explanation. Provide brief, pattern-level \
coaching in `coaching` (or null if the message was clean).

For the most useful mistakes (up to 3, fewer is fine), add a `drills` entry: a SHORT, \
self-contained English sentence (`prompt_en`) that, when translated to German, practices \
exactly the grammar pattern or vocabulary the learner got wrong, plus the correct German \
(`target_de`) and a couple of `tags`. The drill must stand on its own out of context — do \
not reference the conversation. If the message was clean, return an empty `drills` list.
"""


def reply_stream(req: ConversationReplyRequest) -> Iterator[str]:
    """Stream the German reply token-by-token — fast, no thinking, no analysis."""
    settings = get_settings()

    system = CONVERSATION_REPLY_SYSTEM
    if req.scenario:
        system += f"\n\nRoleplay scenario: {req.scenario}. Stay in character."

    messages = [{"role": t.role, "content": t.content} for t in req.history]
    messages.append({"role": "user", "content": req.user_message})

    with client().messages.stream(
        model=settings.conversation_reply_model,
        max_tokens=1024,
        system=system,
        messages=messages,
    ) as stream:
        yield from stream.text_stream


def feedback(req: ConversationFeedbackRequest) -> ConversationFeedback:
    """Analyze the learner's message: errors, coaching, and spaced-repetition drills."""
    settings = get_settings()

    system = CONVERSATION_FEEDBACK_SYSTEM
    if req.scenario:
        system += f"\n\nThe conversation's scenario/register: {req.scenario}."

    context = ""
    if req.history:
        recent = req.history[-4:]
        context = "Recent conversation for context:\n" + "\n".join(
            f"{t.role}: {t.content}" for t in recent
        ) + "\n\n"

    user_payload = f"{context}Learner's latest message to review:\n{req.user_message}"

    response = client().messages.parse(
        model=settings.conversation_feedback_model,
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": user_payload}],
        output_format=ConversationFeedback,
    )
    return response.parsed_output
