import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text

async def fix():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@db:5432/election_intel')
    async with AsyncSession(engine) as session:
        await session.execute(text("UPDATE booths SET booth_name = 'PUBLIC INTER COLLEGE ROOM NO. 26 SADHOLI KADEEM' WHERE booth_number = '64' AND constituency_id = (SELECT id FROM constituencies WHERE name = 'Behat' AND election_id = (SELECT id FROM elections WHERE year = 2017 LIMIT 1))"))
        await session.commit()
    print('Fixed in DB')

asyncio.run(fix())
