from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

import app.main as main



@pytest.fixture
def client():
    with TestClient(main.app) as test_client:
        yield test_client


def _mock_actual_response(request: httpx.Request) -> httpx.Response:
    assert request.url.path.endswith("/datasets/FUELHH/stream")
    assert request.url.params["settlementDateFrom"] == "2026-01-01"
    assert request.url.params["settlementDateTo"] == "2026-01-31"
    assert request.url.params["fuelType"] == "WIND"
    return httpx.Response(200, json=[{"dataset": "FUELHH", "startTime": "2026-01-17T09:30:00Z", "settlementDate": "2026-01-17", "settlementPeriod": 20, "fuelType": "WIND", "generation": 5843, "publishTime": "2026-01-17T10:00:00Z"}])


def _mock_forecast_response(request: httpx.Request) -> httpx.Response:
    assert request.url.path.endswith("/datasets/WINDFOR/stream")
    assert request.url.params["publishDateTimeFrom"] == "2026-01-01T00:00:00Z"
    assert request.url.params["publishDateTimeTo"] == "2026-02-01T00:00:00Z"
    return httpx.Response(200, json=[{"dataset": "WINDFOR", "publishTime": "2026-01-31T22:30:00Z", "startTime": "2026-01-30T21:00:00Z", "generation": 17683}])


def test_actual_endpoint_forwards_valid_query(client, monkeypatch):
    transport = httpx.MockTransport(_mock_actual_response)
    monkeypatch.setattr(main.app.state, "http_client", httpx.AsyncClient(transport=transport))

    response = client.get("/api/v1/wind/actual?settlementDateFrom=2026-01-01&settlementDateTo=2026-01-31&fuelType=WIND")

    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset"] == "FUELHH"
    assert payload["count"] == 1
    assert payload["data"][0]["generation"] == 5843


def test_forecast_endpoint_forwards_valid_query(client, monkeypatch):
    transport = httpx.MockTransport(_mock_forecast_response)
    monkeypatch.setattr(main.app.state, "http_client", httpx.AsyncClient(transport=transport))

    response = client.get("/api/v1/wind/forecast?publishDateTimeFrom=2026-01-01T00:00:00Z&publishDateTimeTo=2026-02-01T00:00:00Z")

    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset"] == "WINDFOR"
    assert payload["count"] == 1
    assert payload["data"][0]["generation"] == 17683


def test_actual_rejects_invalid_date(client):
    response = client.get("/api/v1/wind/actual?settlementDateFrom=2026-02-30&settlementDateTo=2026-02-28&fuelType=WIND")
    assert response.status_code == 422


def test_forecast_rejects_naive_datetime(client):
    response = client.get("/api/v1/wind/forecast?publishDateTimeFrom=2026-01-01T00:00:00&publishDateTimeTo=2026-01-02T00:00:00")
    assert response.status_code == 422


def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
