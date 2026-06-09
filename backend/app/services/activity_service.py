import uuid
import random
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity import Activity, Pref
from app.config import get_settings
import os


class ActivityService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    async def get_activities(
        self,
        cantons: list[str],
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        session_id: Optional[str] = None,
    ) -> list[Activity]:
        """Get activities for selected cantons, sorted by learning model."""

        query = select(Activity).where(Activity.canton.in_(cantons))
        result = await self.db.execute(query)
        activities = list(result.scalars().all())

        # Fetch prefs for this session
        prefs = {}
        if session_id:
            pref_query = select(Pref).where(Pref.session_id == session_id)
            pref_result = await self.db.execute(pref_query)
            for pref in pref_result.scalars():
                prefs[pref.activity_id] = pref.score

        sorted_activities = self._sort_deck(activities, prefs, date_from, date_to, session_id)
        return sorted_activities

    def _sort_deck(
        self,
        activities: list[Activity],
        prefs: dict[str, int],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        session_id: Optional[str],
    ) -> list[Activity]:
        events = [a for a in activities if a.type == "event"]
        evergreen = [a for a in activities if a.type == "evergreen"]

        # Events sorted by proximity to weekend
        if date_from and events:
            events.sort(key=lambda e: abs((e.date_from - date_from).days) if e.date_from else 0)
        else:
            random.shuffle(events)

        # Evergreen sorted by pref score DESC, then tag_score DESC
        evergreen.sort(
            key=lambda a: (
                prefs.get(a.id, 0),
                self._tag_score(a, prefs),
            ),
            reverse=True,
        )

        # Inject novelty every 5th position
        unseen = [a for a in evergreen if prefs.get(a.id, 0) == 0]
        if unseen:
            random.shuffle(unseen)
            unseen_idx = 0

            result = []
            evergreen_idx = 0
            for i in range(len(evergreen) + len(events)):
                if i > 0 and i % 5 == 0 and unseen_idx < len(unseen):
                    result.append(unseen[unseen_idx])
                    unseen_idx += 1
                if evergreen_idx < len(evergreen):
                    result.append(evergreen[evergreen_idx])
                    evergreen_idx += 1
            return events + result

        return events + evergreen

    def _tag_score(self, activity: Activity, prefs: dict[str, int]) -> float:
        """Average pref score of all seen activities sharing tags."""
        activity_tags = set(activity.tags or [])
        if not activity_tags:
            return 0.0

        matching_scores = []
        for activity_id, score in prefs.items():
            if activity_id == activity.id:
                continue
            matching_scores.append(score)

        if not matching_scores:
            return 0.0
        return sum(matching_scores) / len(matching_scores)

    async def upsert_activity(self, activity_data: dict) -> Activity:
        """Upsert an activity by google_place_id or id."""
        google_place_id = activity_data.get("google_place_id")
        activity_id = activity_data.get("id")

        if google_place_id:
            query = select(Activity).where(Activity.google_place_id == google_place_id)
        elif activity_id:
            query = select(Activity).where(Activity.id == activity_id)
        else:
            activity_data["id"] = str(uuid.uuid4())
            activity = Activity(**activity_data)
            self.db.add(activity)
            await self.db.flush()
            return activity

        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            for key, value in activity_data.items():
                if key not in ("id", "created_at") and value is not None:
                    setattr(existing, key, value)
            existing.last_scraped_at = datetime.utcnow()
            await self.db.flush()
            return existing
        else:
            if not activity_id:
                activity_data["id"] = str(uuid.uuid4())
            activity = Activity(**activity_data)
            self.db.add(activity)
            await self.db.flush()
            return activity

    def photo_url_for(self, activity: Activity) -> Optional[str]:
        """Return the public URL for an activity's photo."""
        if activity.photo_path:
            return f"/uploads/photos/{os.path.basename(activity.photo_path)}"
        return None