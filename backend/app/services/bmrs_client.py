from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger("wattsight.bmrs")


class BMRSClientError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def _parse_upstream_json(text: str) -> list[dict[str, Any]]:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:  # pragma: no cover - exercised via tests
        raise BMRSClientError("BMRS returned malformed JSON") from exc

    if isinstance(payload, dict):
        return [payload]
    if isinstance(payload, list):
        if not payload:
            return []
        if all(isinstance(item, dict) for item in payload):
            return payload
        raise BMRSClientError("BMRS returned an unsupported JSON shape")

    raise BMRSClientError("BMRS returned an unsupported JSON shape")


async def fetch_dataset(client: httpx.AsyncClient, dataset: str, params: dict[str, str]) -> list[dict[str, Any]]:
    if not settings.BMRS_BASE_URL:
        raise BMRSClientError("BMRS_BASE_URL is not configured", status_code=503)

    url = f"{settings.BMRS_BASE_URL}/datasets/{dataset}/stream"
    last_error: Exception | None = None

    for attempt in range(settings.HTTP_MAX_RETRIES + 1):
        try:
            response = await client.get(
                url,
                params=params,
                timeout=httpx.Timeout(
                    connect=settings.HTTP_CONNECT_TIMEOUT,
                    read=settings.HTTP_READ_TIMEOUT,
                    write=settings.HTTP_READ_TIMEOUT,
                    pool=settings.HTTP_READ_TIMEOUT,
                ),
            )
            if response.status_code >= 400:
                raise httpx.HTTPStatusError(
                    f"Upstream returned {response.status_code}",
                    request=response.request,
                    response=response,
                )
            text = response.text
            if not text or text.strip() == "":
                return []
            return _parse_upstream_json(text)
        except httpx.TimeoutException as exc:  # pragma: no cover - network boundary
            last_error = exc
            logger.warning("BMRS timeout dataset=%s params=%s attempt=%s", dataset, params, attempt + 1)
            if attempt < settings.HTTP_MAX_RETRIES:
                await asyncio.sleep(0.25 * (attempt + 1))
                continue
            raise BMRSClientError("The BMRS request timed out", status_code=504) from exc
        except httpx.HTTPStatusError as exc:
            last_error = exc
            status = exc.response.status_code if exc.response is not None else 502
            logger.warning("BMRS HTTP error dataset=%s status=%s attempt=%s", dataset, status, attempt + 1)
            if status >= 500 and attempt < settings.HTTP_MAX_RETRIES:
                await asyncio.sleep(0.25 * (attempt + 1))
                continue
            raise BMRSClientError("BMRS did not return a usable response", status_code=502 if status < 500 else 503) from exc
        except (httpx.RequestError, ValueError) as exc:
            last_error = exc
            logger.warning("BMRS request failed dataset=%s error=%s attempt=%s", dataset, type(exc).__name__, attempt + 1)
            if attempt < settings.HTTP_MAX_RETRIES:
                await asyncio.sleep(0.25 * (attempt + 1))
                continue
            raise BMRSClientError("BMRS did not return a usable response", status_code=502) from exc

    if last_error is not None:
        raise BMRSClientError("BMRS did not return a usable response", status_code=502) from last_error

    raise BMRSClientError("BMRS did not return a usable response", status_code=502)


def build_envelope(dataset: str, filters: dict[str, str], records: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "dataset": dataset,
        "filters": filters,
        "count": len(records),
        "data": records,
        "source": "Elexon BMRS",
        "requestedAt": datetime.now(timezone.utc).isoformat(),
    }
