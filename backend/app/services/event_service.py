from datetime import datetime, timedelta
from typing import Optional
import httpx
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.models.activity import Activity


CACHE_TTL = timedelta(hours=6)

_events_cache: dict[str, tuple[list, datetime]] = {}


class EventService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _cache_key(self, date_from: str, date_to: str, cantons: list[str]) -> str:
        return f"{date_from}_{date_to}_{'_'.join(sorted(cantons))}"

    async def get_events(
        self,
        date_from: str,
        date_to: str,
        cantons: list[str],
    ) -> list[Activity]:
        key = self._cache_key(date_from, date_to, cantons)

        if key in _events_cache:
            cached_events, cached_at = _events_cache[key]
            if datetime.utcnow() - cached_at < CACHE_TTL:
                return cached_events

        events = await self._scrape_events(date_from, date_to, cantons)
        _events_cache[key] = (events, datetime.utcnow())
        return events

    async def _scrape_events(
        self,
        date_from: str,
        date_to: str,
        cantons: list[str],
    ) -> list[Activity]:
        """Scrape events from agenda.ch for selected cantons."""
        from app.scrapers.agenda_ch import scrape_events_for_cantons

        scraped = await scrape_events_for_cantons(date_from, date_to, cantons)

        # Upsert into DB
        activities = []
        for event_data in scraped:
            activity = await self._upsert_event(event_data)
            if activity:
                activities.append(activity)

        return activities

    async def _upsert_event(self, event_data: dict) -> Optional[Activity]:
        """Upsert an event by title + date_from + canton."""
        title = event_data.get("title")
        date_from = event_data.get("date_from")
        canton = event_data.get("canton")

        if not all([title, date_from, canton]):
            return None

        query = select(Activity).where(
            Activity.title == title,
            Activity.date_from == date_from,
            Activity.canton == canton,
            Activity.type == "event",
        )
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            for key, value in event_data.items():
                if key not in ("id", "created_at") and value is not None:
                    setattr(existing, key, value)
            await self.db.flush()
            return existing
        else:
            event_data["id"] = str(uuid.uuid4())
            event_data["type"] = "event"
            activity = Activity(**event_data)
            self.db.add(activity)
            await self.db.flush()
            return activity

    @staticmethod
    async def cleanup_old_events():
        """Delete events where date_to < now - 7 days."""
        from app.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            cutoff = datetime.utcnow() - timedelta(days=7)
            await db.execute(
                delete(Activity).where(
                    Activity.type == "event",
                    Activity.date_to < cutoff,
                )
            )
            await db.commit()