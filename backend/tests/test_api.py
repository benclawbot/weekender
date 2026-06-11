import pytest
import uuid
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import delete

from app.main import app
from app.database import AsyncSessionLocal
from app.models.activity import Activity, Pref, Basket, BasketActivity


@pytest_asyncio.fixture
async def client():
    """Client fixture that wipes volatile tables (prefs/baskets) before
    each test. Activities are left intact because they're the seed dataset
    the API queries against.
    """
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Pref))
        await db.execute(delete(BasketActivity))
        await db.execute(delete(Basket))
        await db.commit()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(autouse=True)
async def _cleanup_after():
    yield
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Pref))
        await db.execute(delete(BasketActivity))
        await db.execute(delete(Basket))
        await db.commit()


@pytest.mark.asyncio
async def test_health(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_list_activities(client):
    response = await client.get("/api/v1/activities?cantons=GE,VD")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_list_activities_requires_cantons(client):
    response = await client.get("/api/v1/activities")
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_list_events_requires_params(client):
    response = await client.get("/api/v1/events")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_prefs_requires_session_id(client):
    response = await client.get("/api/v1/prefs")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_post_pref(client):
    session_id = f"test-session-{uuid.uuid4()}"
    response = await client.post(
        "/api/v1/prefs",
        json={
            "activity_id": "test-activity-id",
            "direction": "yes",
            "session_id": session_id,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["activity_id"] == "test-activity-id"
    assert data["score"] == 2  # yes = +2


@pytest.mark.asyncio
async def test_post_pref_invalid_direction(client):
    response = await client.post(
        "/api/v1/prefs",
        json={
            "activity_id": "test-id",
            "direction": "invalid",
            "session_id": "session",
        },
    )
    assert response.status_code == 200
    assert "error" in response.json()


@pytest.mark.asyncio
async def test_baskets_requires_session_id(client):
    response = await client.get("/api/v1/baskets")
    assert response.status_code == 422
