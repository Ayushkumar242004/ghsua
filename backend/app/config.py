from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR / ".env.local")
load_dotenv(BASE_DIR.parent / ".env")


class Settings:
    BMRS_BASE_URL = os.getenv("BMRS_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1").rstrip("/")
    FRONTEND_ORIGINS = [
        origin.strip()
        for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
        if origin.strip()
    ]
    HTTP_CONNECT_TIMEOUT = float(os.getenv("HTTP_CONNECT_TIMEOUT", "10"))
    HTTP_READ_TIMEOUT = float(os.getenv("HTTP_READ_TIMEOUT", "60"))
    HTTP_MAX_RETRIES = int(os.getenv("HTTP_MAX_RETRIES", "2"))


settings = Settings()
