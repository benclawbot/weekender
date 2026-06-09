"""
WeekendPlanner — FastAPI entry point.

All routes are registered here. Startup/shutdown events handle
DB connection pool and APScheduler lifecycle.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.api import activities, events, baskets, prefs
from app.scrapers.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()
    await engine.dispose()


app = FastAPI(
    title="WeekendPlanner API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"] if settings.environment == "development" else [],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(activities.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(baskets.router, prefix="/api/v1")
app.include_router(prefs.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
