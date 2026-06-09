from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.event_service import EventService
from app.services.activity_service import ActivityService
from app.models.activity import Pref

router = APIRouter()


@router.get("/events")
async def list_events(
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to: str = Query(..., description="YYYY-MM-DD"),
    cantons: str = Query(..., description="Comma-separated canton codes"),
    session_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    canton_list = [c.strip().upper() for c in cantons.split(",") if c.strip()]
    if not canton_list:
        canton_list = ["GE", "VD", "FR", "VS", "JU"]

    service = EventService(db)
    activity_service = ActivityService(db)
    events = await service.get_events(date_from, date_to, canton_list)

    pref_scores: dict[str, int] = {}
    if session_id:
        pref_rows = await db.execute(select(Pref).where(Pref.session_id == session_id))
        for p in pref_rows.scalars():
            pref_scores[p.activity_id] = p.score

    return [
        {
            "id": e.id,
            "title": e.title,
            "type": e.type,
            "canton": e.canton,
            "address": e.address,
            "lat": e.lat,
            "lng": e.lng,
            "opening_hours": e.opening_hours,
            "photo_url": activity_service.photo_url_for(e),
            "maps_url": e.maps_url,
            "website": e.website,
            "tags": e.tags or [],
            "duration_hint": e.duration_hint,
            "pref_score": pref_scores.get(e.id, 0),
            "date_from": e.date_from.isoformat() if e.date_from else None,
            "date_to": e.date_to.isoformat() if e.date_to else None,
            "source_url": e.source_url,
        }
        for e in events
    ]