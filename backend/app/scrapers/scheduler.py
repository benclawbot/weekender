"""
APScheduler setup for background scraping jobs.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.services.event_service import EventService


scheduler = AsyncIOScheduler()


def start_scheduler():
    # Quarterly Google Places refresh (every 90 days at 03:00)
    # Using interval since day="*/90" is invalid (max day range is 1-30)
    scheduler.add_job(
        _run_place_scraper,
        IntervalTrigger(days=90, hours=3),
        id="google_places_scraper",
        replace_existing=True,
    )

    # Daily event cleanup (delete old events)
    scheduler.add_job(
        EventService.cleanup_old_events,
        CronTrigger(hour=2, minute=0),
        id="event_cleanup",
        replace_existing=True,
    )

    scheduler.start()
    print("[scheduler] Started")


def stop_scheduler():
    scheduler.shutdown(wait=False)
    print("[scheduler] Stopped")


async def _run_place_scraper():
    from app.scrapers.google_places import run_google_places_scraper
    from app.database import AsyncSessionLocal
    from app.services.activity_service import ActivityService

    print("[scraper] Running Google Places scraper...")
    try:
        results = await run_google_places_scraper()
        print(f"[scraper] Scraped {len(results)} activities")

        async with AsyncSessionLocal() as db:
            service = ActivityService(db)
            for activity_data in results:
                await service.upsert_activity(activity_data)
            await db.commit()
        print("[scraper] Saved to database")
    except Exception as e:
        print(f"[scraper] Error: {e}")