from datetime import datetime

import pytest

from app.models.activity import Activity
from app.services.activity_service import ActivityService


@pytest.mark.asyncio
async def test_get_activities_returns_each_evergreen_once(db_session):
    db_session.add_all(
        [
            Activity(id="evergreen-1", title="One", type="evergreen", canton="GE", tags=[]),
            Activity(id="evergreen-2", title="Two", type="evergreen", canton="GE", tags=[]),
            Activity(
                id="event-1",
                title="Temporary",
                type="event",
                canton="GE",
                tags=[],
                date_from=datetime(2026, 6, 13),
            ),
        ]
    )
    await db_session.commit()

    activities = await ActivityService(db_session).get_activities(["GE"])

    assert {activity.id for activity in activities} == {"evergreen-1", "evergreen-2"}
    assert len(activities) == 2
