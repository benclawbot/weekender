"""Backfill missing local photos for existing Google Places activities."""
import argparse
import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.activity import Activity
from app.scrapers.google_places import _download_photo, _get_place_details, settings


async def backfill_photos(limit: int | None = None) -> tuple[int, int]:
    async with AsyncSessionLocal() as db:
        query = select(Activity).where(
            Activity.type == "evergreen",
            Activity.google_place_id.is_not(None),
            Activity.photo_path.is_(None),
            Activity.photo_url.is_(None),
        )
        if limit:
            query = query.limit(limit)

        activities = list((await db.execute(query)).scalars().all())
        saved = 0

        for index, activity in enumerate(activities, start=1):
            details = await _get_place_details(activity.google_place_id, settings.google_places_api_key)
            photos = details.get("photos", []) if details else []
            photo_ref = photos[0].get("photo_reference") if photos else None
            if photo_ref:
                activity.photo_path = await _download_photo(photo_ref, activity.id)
                if activity.photo_path:
                    saved += 1

            if index % 10 == 0:
                await db.commit()
            await asyncio.sleep(0.12)

        await db.commit()
        return saved, len(activities)


async def main(limit: int | None) -> None:
    saved, attempted = await backfill_photos(limit)
    print(f"[photos] Saved {saved}/{attempted} missing activity photos.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill missing Google Places activity photos")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    asyncio.run(main(args.limit))
