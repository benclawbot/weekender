import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.activity import Basket, BasketActivity, Activity
from app.schemas import BasketCreate, BasketResponse, BasketActivitySchema

router = APIRouter()


@router.get("/baskets")
async def list_baskets(
    session_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Basket)
        .where(Basket.session_id == session_id)
        .options(selectinload(Basket.activities).selectinload(BasketActivity.activity))
        .order_by(Basket.created_at.desc())
    )
    result = await db.execute(query)
    baskets = result.scalars().all()

    return [_basket_to_response(b) for b in baskets]


@router.post("/baskets")
async def create_basket(
    basket_data: BasketCreate,
    db: AsyncSession = Depends(get_db),
):
    basket_id = str(uuid.uuid4())

    basket = Basket(
        id=basket_id,
        session_id=basket_data.session_id,
        date_from=datetime.fromisoformat(basket_data.date_from),
        date_to=datetime.fromisoformat(basket_data.date_to),
    )
    db.add(basket)

    for activity_id in basket_data.activity_ids:
        ba = BasketActivity(
            basket_id=basket_id,
            activity_id=activity_id,
        )
        db.add(ba)

    await db.commit()
    await db.refresh(basket)

    # Reload with relationships
    query = (
        select(Basket)
        .where(Basket.id == basket_id)
        .options(selectinload(Basket.activities).selectinload(BasketActivity.activity))
    )
    result = await db.execute(query)
    basket = result.scalar_one()

    return _basket_to_response(basket)


@router.get("/baskets/{basket_id}")
async def get_basket(
    basket_id: str,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Basket)
        .where(Basket.id == basket_id)
        .options(selectinload(Basket.activities).selectinload(BasketActivity.activity))
    )
    result = await db.execute(query)
    basket = result.scalar_one_or_none()

    if not basket:
        raise HTTPException(status_code=404, detail="Basket not found")

    return _basket_to_response(basket)


@router.delete("/baskets/{basket_id}")
async def delete_basket(
    basket_id: str,
    db: AsyncSession = Depends(get_db),
):
    query = select(Basket).where(Basket.id == basket_id)
    result = await db.execute(query)
    basket = result.scalar_one_or_none()

    if not basket:
        raise HTTPException(status_code=404, detail="Basket not found")

    await db.delete(basket)
    await db.commit()
    return {"ok": True}


@router.patch("/baskets/{basket_id}/activities/{activity_id}")
async def remove_activity_from_basket(
    basket_id: str,
    activity_id: str,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete
    from app.models.activity import BasketActivity

    await db.execute(
        delete(BasketActivity).where(
            BasketActivity.basket_id == basket_id,
            BasketActivity.activity_id == activity_id,
        )
    )
    await db.commit()
    return {"ok": True}


def _basket_to_response(basket: Basket) -> dict:
    return {
        "id": basket.id,
        "session_id": basket.session_id,
        "date_from": basket.date_from.isoformat() if basket.date_from else None,
        "date_to": basket.date_to.isoformat() if basket.date_to else None,
        "created_at": basket.created_at.isoformat() if basket.created_at else None,
        "activities": [
            {
                "id": ba.activity.id,
                "title": ba.activity.title,
                "type": ba.activity.type,
                "canton": ba.activity.canton,
                "address": ba.activity.address,
                "lat": ba.activity.lat,
                "lng": ba.activity.lng,
                "photo_url": f"/uploads/photos/{ba.activity.photo_path}" if ba.activity.photo_path else None,
                "maps_url": ba.activity.maps_url,
                "website": ba.activity.website,
                "tags": ba.activity.tags or [],
                "duration_hint": ba.activity.duration_hint,
                "pref_score": 0,
            }
            for ba in basket.activities
        ],
    }