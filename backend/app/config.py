import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///weekendplanner.db"
    google_places_api_key: str = ""
    secret_key: str = "changeme"
    environment: str = "development"
    event_cache_ttl_hours: int = 6
    photos_dir: str = "uploads/photos"

    @property
    def static_uploads_dir(self) -> str:
        # Resolve photos_dir relative to the backend/ directory so it works
        # regardless of where uvicorn is launched from.
        backend_dir = Path(__file__).parent.parent
        return str(backend_dir / self.photos_dir)

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()