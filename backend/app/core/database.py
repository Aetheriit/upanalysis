"""Database connection and session management."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

# Render provides PostgreSQL URLs using the standard ``postgresql://`` scheme,
# while SQLAlchemy's async engine requires the asyncpg driver explicitly.
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# SQLite doesn't support pool_size/max_overflow — only add for PostgreSQL
is_postgres = database_url.startswith("postgresql")
engine_kwargs = {"echo": settings.DEBUG}
if is_postgres:
    engine_kwargs["pool_size"] = 20
    engine_kwargs["max_overflow"] = 10

engine = create_async_engine(database_url, **engine_kwargs)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""
    pass


async def get_db():
    """Dependency that yields database sessions."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
