from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# The backend package root (…/backend), so the DB location doesn't depend on the
# directory uvicorn was launched from.
BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """App configuration, loaded from environment / .env.

    The Anthropic key lives here on the backend only — it never reaches the browser.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    anthropic_api_key: str = ""
    cors_origins: str = "http://localhost:5173"
    # Cost-tiered defaults: cheap+fast model for the high-volume structured grading
    # call, a mid model for open-ended conversation. Bump to claude-opus-4-8 for
    # either if you want maximum quality.
    grading_model: str = "claude-haiku-4-5"
    # Conversation is split into a fast streamed reply and a background feedback pass.
    conversation_reply_model: str = "claude-haiku-4-5"
    conversation_feedback_model: str = "claude-sonnet-4-6"
    # Bearer token protecting the app. Empty = auth disabled (local dev).
    app_token: str = ""
    # Absolute by default so it always resolves to backend/german_tracker.db.
    # A relative DB_PATH override is resolved against the backend dir too.
    db_path: str = str(BACKEND_DIR / "german_tracker.db")

    @property
    def resolved_db_path(self) -> str:
        p = Path(self.db_path)
        return str(p if p.is_absolute() else BACKEND_DIR / p)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
