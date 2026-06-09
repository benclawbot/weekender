from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///weekendplanner.db"
    google_places_api_key: str = ""
    secret_key: str = "changeme"
    environment: str = "development"
    event_cache_ttl_hours: int = 6
    photos_dir: str = "uploads/photos"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()