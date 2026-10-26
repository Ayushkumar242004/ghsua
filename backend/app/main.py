from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.api.routes.wind import router as wind_router
from app.config import settings

logging.basicConfig(level="INFO")
logger = logging.getLogger("wattsight.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(
        headers={"accept": "text/plain"},
        timeout=httpx.Timeout(
            connect=settings.HTTP_CONNECT_TIMEOUT,
            read=settings.HTTP_READ_TIMEOUT,
            write=settings.HTTP_READ_TIMEOUT,
            pool=settings.HTTP_READ_TIMEOUT,
        ),
    )
    try:
        yield
    finally:
        await app.state.http_client.aclose()


app = FastAPI(title="WattSight API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(wind_router)
