"""
Seed script: run Google Places scraper and populate DB.
Usage: python -m app.scrapers.seed --cantons GE,VD,FR,VS,JU --limit 50
"""
import asyncio
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.database import AsyncSessionLocal
from app.services.activity_service import ActivityService
from app.scrapers.google_places import run_google_places_scraper


async def seed(cantons: list[str], limit: int = 50):
    print(f"[seed] Starting seed for cantons: {cantons}")
    results = await run_google_places_scraper(cantons)

    # Apply limit PER canton, not to total
    by_canton: dict[str, list] = {}
    for r in results:
        canton = r.get("canton", "?")
        by_canton.setdefault(canton, []).append(r)
    for canton in by_canton:
        if limit:
            by_canton[canton] = by_canton[canton][:limit]

    flat = [r for bucket in by_canton.values() for r in bucket]
    print(f"[seed] Scraped {len(flat)} activities (limit {limit} per canton), writing to DB...")

    async with AsyncSessionLocal() as db:
        service = ActivityService(db)
        for activity_data in flat:
            await service.upsert_activity(activity_data)
        await db.commit()

    print(f"[seed] Done. {len(flat)} activities saved.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed activities from Google Places")
    parser.add_argument("--cantons", default="GE,VD,FR,VS,JU", help="Comma-separated canton codes")
    parser.add_argument("--limit", type=int, default=50, help="Max activities per canton")
    args = parser.parse_args()

    canton_list = [c.strip().upper() for c in args.cantons.split(",")]
    asyncio.run(seed(canton_list, args.limit))