from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request

from app.services.bmrs_client import BMRSClientError, build_envelope, fetch_dataset

router = APIRouter(prefix="/api/v1")


def validate_date_range(start: date, end: date) -> None:
    if start > end:
        raise ValueError("settlementDateFrom must be earlier than or equal to settlementDateTo")


def normalize_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("Timestamps must be timezone-aware and include UTC offset or Z")
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@router.get("/wind/actual")
async def actual_generation(
    request: Request,
    settlementDateFrom: date = Query(..., description="Inclusive start settlement date (YYYY-MM-DD)"),
    settlementDateTo: date = Query(..., description="Inclusive end settlement date (YYYY-MM-DD)"),
    fuelType: Literal["WIND"] = Query("WIND", description="Restricted to WIND for this application"),
):
    try:
        validate_date_range(settlementDateFrom, settlementDateTo)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    filters = {
        "settlementDateFrom": settlementDateFrom.isoformat(),
        "settlementDateTo": settlementDateTo.isoformat(),
        "fuelType": fuelType,
    }
    try:
        records = await fetch_dataset(request.app.state.http_client, "FUELHH", filters)
    except BMRSClientError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return build_envelope("FUELHH", filters, records)


@router.get("/wind/forecast")
async def forecast_generation(
    request: Request,
    publishDateTimeFrom: datetime = Query(..., description="Inclusive forecast publication start timestamp"),
    publishDateTimeTo: datetime = Query(..., description="Inclusive forecast publication end timestamp"),
):
    try:
        start = normalize_datetime(publishDateTimeFrom)
        end = normalize_datetime(publishDateTimeTo)
        if publishDateTimeFrom > publishDateTimeTo:
            raise ValueError("publishDateTimeFrom must be earlier than or equal to publishDateTimeTo")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    filters = {"publishDateTimeFrom": start, "publishDateTimeTo": end}
    try:
        records = await fetch_dataset(request.app.state.http_client, "WINDFOR", filters)
    except BMRSClientError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return build_envelope("WINDFOR", filters, records)
