from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.activity_service import ActivityService
from app.schemas import ActivityResponse
from app.config import get_settings

router = APIRouter()


@router.get("/activities")
async def list_activities(
    cantons: str = Query(..., description="Comma-separated canton codes: GE,VD,FR,VS,JU"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD for event sorting"),
    date_to: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    canton_list = [c.strip().upper() for c in cantons.split(",") if c.strip()]
    if not canton_list:
        canton_list = ["GE", "VD", "FR", "VS", "JU"]

    date_from_dt = datetime.fromisoformat(date_from) if date_from else None
    date_to_dt = datetime.fromisoformat(date_to) if date_to else None

    service = ActivityService(db)
    activities = await service.get_activities(canton_list, date_from_dt, date_to_dt, session_id)

    return [
        _activity_to_response(a, service) for a in activities
    ]


def _activity_to_response(activity, service: ActivityService) -> dict:
    return {
        "id": activity.id,
        "title": activity.title,
        "type": activity.type,
        "canton": activity.canton,
        "address": activity.address,
        "lat": activity.lat,
        "lng": activity.lng,
        "opening_hours": activity.opening_hours,
        "photo_url": service.photo_url_for(activity),
        "maps_url": activity.maps_url,
        "website": activity.website,
        "tags": activity.tags or [],
        "duration_hint": activity.duration_hint,
        "pref_score": 0,
        "date_from": activity.date_from.isoformat() if activity.date_from else None,
        "date_to": activity.date_to.isoformat() if activity.date_to else None,
        "source_url": activity.source_url,
    }