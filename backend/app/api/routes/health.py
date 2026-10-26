from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.wind import HealthResponse

router = APIRouter()


@router.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service="wattsight-api", timestamp=datetime.now(timezone.utc).isoformat())
