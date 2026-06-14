from fastapi import APIRouter, HTTPException, UploadFile

from ..schemas import TranscribeResult

router = APIRouter(tags=["transcribe"])


@router.post("/transcribe", response_model=TranscribeResult)
async def transcribe(audio: UploadFile) -> TranscribeResult:
    """Speech-to-text for German audio.

    STUB: wire this to a German-capable STT engine (e.g. Whisper large-v3, self-hosted
    or via a provider). It should return the transcript plus a confidence score so the
    grader can flag likely_asr_error. For now it rejects so the contract is explicit.
    """
    _ = await audio.read()
    raise HTTPException(
        status_code=501,
        detail="Transcription not yet implemented — connect a German STT engine here.",
    )
