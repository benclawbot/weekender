from datetime import datetime, timedelta
from typing import Optional
import httpx
from sqlalchemy import select, delete, func
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

        # Try live scrape first; fall back to DB on any failure.
        try:
            events = await self._scrape_events(date_from, date_to, cantons)
        except Exception as e:
            print(f"[events] live scrape failed, falling back to DB: {e}")
            events = []
        if not events:
            events = await self._query_db_events(date_from, date_to, cantons)
        _events_cache[key] = (events, datetime.utcnow())
        return events

    async def _query_db_events(
        self,
        date_from: str,
        date_to: str,
        cantons: list[str],
    ) -> list[Activity]:
        """Read events for [date_from, date_to] + cantons straight from the DB.

        Used as a fallback when the live agenda.ch scrape fails (no internet,
        site down, HTML changed). Lets the local dev experience keep working
        using whatever events are already persisted.
        """
        try:
            df = datetime.fromisoformat(date_from)
            dt = datetime.fromisoformat(date_to)
        except ValueError:
            return []

        # The window inputs are YYYY-MM-DD, treated as inclusive day-precision
        # bounds. We compare day-precision too so a date_from with a non-zero
        # time-of-day (e.g. seeded events at 21:28) still matches a window end
        # at 00:00 of the same calendar date.
        query = (
            select(Activity)
            .where(
                Activity.type == "event",
                Activity.canton.in_(cantons),
                func.date(Activity.date_from) <= dt.date(),
                func.date(Activity.date_to) >= df.date(),
            )
            .order_by(Activity.date_from.asc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def _scrape_events(
        self,
        date_from: str,
        date_to: str,
        cantons: list[str],
    ) -> list[Activity]:
        """Scrape events from myswitzerland.com for selected cantons.

        Only VD is wired up in the scraper today; other cantons return no
        events from the live scrape and fall through to the DB cache.
        """
        from app.scrapers.myswiss_com import scrape_events_for_cantons

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
        """Delete events whose date_to is more than 7 days in the past.

        Wrapped in try/except so a single failed run never brings down the
        scheduler thread.
        """
        from app.database import AsyncSessionLocal

        try:
            async with AsyncSessionLocal() as db:
                cutoff = datetime.utcnow() - timedelta(days=7)
                result = await db.execute(
                    delete(Activity).where(
                        Activity.type == "event",
                        Activity.date_to < cutoff,
                    )
                )
                await db.commit()
                if result.rowcount:
                    print(f"[cleanup] removed {result.rowcount} stale events")
        except Exception as e:
            print(f"[cleanup] failed (continuing): {e}")