from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from .config import get_settings
from .db import init_db
from .routers import conversation, data, grade, transcribe

settings = get_settings()
init_db()

app = FastAPI(title="German Tracker API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    token = settings.app_token
    if token and request.url.path.startswith("/api/") and request.url.path != "/api/health":
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {token}":
            return JSONResponse(
                {"detail": "Unauthorized"}, status_code=401,
                headers={"WWW-Authenticate": "Bearer"},
            )
    return await call_next(request)


app.include_router(grade.router, prefix="/api")
app.include_router(conversation.router, prefix="/api")
app.include_router(transcribe.router, prefix="/api")
app.include_router(data.router, prefix="/api")


@app.get("/api/health", tags=["meta"])
@app.get("/health", tags=["meta"], include_in_schema=False)
def health() -> dict[str, object]:
    return {"status": "ok", "has_api_key": bool(settings.anthropic_api_key)}


# Serve the built frontend. Falls back gracefully when dist/ doesn't exist (local dev).
DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if DIST.exists():
    _assets = DIST / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str) -> FileResponse:
        candidate = DIST / full_path
        try:
            candidate.resolve().relative_to(DIST.resolve())
            if candidate.is_file():
                return FileResponse(str(candidate))
        except ValueError:
            pass
        return FileResponse(str(DIST / "index.html"))
