from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/weekendplanner"
    google_places_api_key: str = ""
    secret_key: str = "changeme"
    environment: str = "development"
    event_cache_ttl_hours: int = 6

    class Config:
        env_file = ".env"


settings = Settings()
