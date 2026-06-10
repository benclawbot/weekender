"""
WeekendPlanner — FastAPI entry point.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func

from app.config import get_settings
from app.database import engine, Base, AsyncSessionLocal
from app.api import activities, events, baskets, prefs
from app.scrapers.scheduler import start_scheduler, stop_scheduler
from app.models.activity import Activity

settings = get_settings()


async def _ensure_seed_data():
    """Self-heal: if the activities table is empty, populate it from the
    local seed. Production / docker installs with a real Google Places API
    key will skip this because activities already exist (and quarterly
    scraper takes over).
    """
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(func.count(Activity.id)))
        count = result.scalar() or 0
        if count > 0:
            print(f"[startup] {count} activities already present — skipping auto-seed")
            return

    print("[startup] activities table empty — auto-seeding local data")
    from app.scrapers.seed_local import seed as seed_local_data
    await seed_local_data()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Local-dev self-heal: keep the DB usable even if it's been wiped.
    if settings.environment == "development":
        try:
            await _ensure_seed_data()
        except Exception as e:
            # Never let the seed failure block startup — just log and continue.
            print(f"[startup] auto-seed failed (continuing without): {e}")

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

# Static files for uploaded photos served at /uploads/photos/...
# The photos_dir setting (uploads/photos) is relative to the backend root.
app.mount("/uploads", StaticFiles(directory=settings.static_uploads_dir), name="uploads")

# CORS
cors_origins = ["http://localhost:5173"] if settings.environment == "development" else []
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(activities.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(baskets.router, prefix="/api/v1")
app.include_router(prefs.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}