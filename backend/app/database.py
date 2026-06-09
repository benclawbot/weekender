from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings


settings = get_settings()

is_sqlite = "sqlite" in settings.database_url

connect_args = {}
extra_kwargs = {}
if is_sqlite:
    connect_args = {"check_same_thread": False}
else:
    extra_kwargs = {"pool_size": 10, "max_overflow": 20}

engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    connect_args=connect_args,
    **extra_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()