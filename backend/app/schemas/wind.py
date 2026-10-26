from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WindDataEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dataset: str
    filters: dict[str, str]
    count: int = Field(ge=0)
    data: list[dict[str, Any]]
    source: str = "Elexon BMRS"
    requestedAt: str


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
