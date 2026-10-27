import asyncio

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.database import Base, engine as app_engine

pytest_plugins = ["pytest_asyncio"]


@pytest.fixture(scope="session")
def event_loop():
    """Run the whole session on one event loop.

    The application engine pools its connections. pytest-asyncio creates a new
    loop per test by default, and an asyncpg connection cannot be reused from a
    different loop ("attached to a different loop" / "another operation is in
    progress"). A single session loop keeps the pool usable.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _app_schema():
    """Create the schema on the configured database before any test runs.

    CI points DATABASE_URL at a fresh PostgreSQL service, and a fresh checkout
    has no SQLite file either: without this the very first query fails with
    UndefinedTable on prefs.
    """
    async with app_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await app_engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine):
    async_session = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session