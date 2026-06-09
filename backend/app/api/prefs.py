from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.activity import Pref, Activity
from app.schemas import PrefCreate, PrefResponse

router = APIRouter()

SCORE_DELTA = {"yes": 2, "up": 1, "no": -1}
SCORE_FLOOR = -5


@router.get("/prefs")
async def get_prefs(
    session_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    query = select(Pref).where(Pref.session_id == session_id)
    result = await db.execute(query)
    prefs = result.scalars().all()
    return [{"activity_id": p.activity_id, "score": p.score} for p in prefs]


@router.post("/prefs")
async def record_pref(
    pref_data: PrefCreate,
    db: AsyncSession = Depends(get_db),
):
    direction = pref_data.direction
    if direction not in SCORE_DELTA:
        return {"error": "Invalid direction"}

    query = select(Pref).where(
        Pref.session_id == pref_data.session_id,
        Pref.activity_id == pref_data.activity_id,
    )
    result = await db.execute(query)
    pref = result.scalar_one_or_none()

    if pref:
        delta = SCORE_DELTA[direction]
        new_score = max(SCORE_FLOOR, pref.score + delta)
        # Favourites floor: score >= 2 cannot drop below 2
        if pref.score >= 2 and direction == "no":
            new_score = max(2, new_score)
        pref.score = new_score
    else:
        delta = SCORE_DELTA[direction]
        score = max(SCORE_FLOOR, delta)
        pref = Pref(
            session_id=pref_data.session_id,
            activity_id=pref_data.activity_id,
            score=score,
        )
        db.add(pref)

    await db.commit()
    return {"activity_id": pref.activity_id, "score": pref.score}