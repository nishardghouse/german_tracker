from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from .. import llm
from ..schemas import (
    ConversationFeedback,
    ConversationFeedbackRequest,
    ConversationReplyRequest,
)

router = APIRouter(tags=["conversation"])


@router.post("/conversation/reply")
def conversation_reply(req: ConversationReplyRequest) -> StreamingResponse:
    """Stream the German reply so it appears immediately, not after the analysis."""
    return StreamingResponse(
        llm.reply_stream(req),
        media_type="text/plain; charset=utf-8",
    )


@router.post("/conversation/feedback", response_model=ConversationFeedback)
def conversation_feedback(req: ConversationFeedbackRequest) -> ConversationFeedback:
    """Background pass: errors + coaching + drill cards for the user's message.

    Shares the same error model as /grade so both modes feed one error/vocab store.
    """
    return llm.feedback(req)
