"""Apply winner/runner party IDs from the local constituency result CSVs by AC code."""
import asyncio
import csv
import os
from pathlib import Path
import asyncpg


def code_key(value):
    try:
        return str(int(float(str(value).strip())))
    except ValueError:
        return str(value).strip()


def party(value):
    value = str(value or '').strip().upper()
    if value in ('AD(S)', 'ADAL', 'APNA DAL (SONELAL)', 'APNA DAL (SONEY LAL)'):
        return 'AD(S)'
    if value in ('NISHAD PARTY', 'NINSHAD'):
        return 'NISHAD'
    return value


def load(path, indexes):
    result = {}
    with open(path, encoding='utf-8-sig', newline='') as handle:
        for row in csv.reader(handle):
            if len(row) <= max(indexes) or not row[indexes[0]].strip():
                continue
            code = code_key(row[indexes[0]])
            if code in ('#', 'CONSTITUENCY #'):
                continue
            result[code] = (party(row[indexes[1]]), party(row[indexes[2]]))
    return result


async def main():
    root = Path('/app')
    conn = await asyncpg.connect(os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/election_intel').replace('postgresql+asyncpg://', 'postgresql://', 1))
    party_ids = {r['abbreviation'].upper(): r['id'] for r in await conn.fetch('SELECT id, abbreviation FROM parties')}
    sources = {2022: load(root / 'wiki_2022.csv', (1, 6, 11)), 2017: load(root / 'up_2017_results.csv', (1, 5, 10))}
    for year, source in sources.items():
        updated = 0
        consts = await conn.fetch('SELECT co.id, co.code FROM constituencies co JOIN elections e ON e.id=co.election_id WHERE e.year=$1', year)
        election_id = await conn.fetchval('SELECT id FROM elections WHERE year=$1 LIMIT 1', year)
        for const in consts:
            parties = source.get(code_key(const['code']))
            if not parties:
                continue
            for position, abbreviation in ((1, parties[0]), (2, parties[1])):
                party_id = party_ids.get(abbreviation)
                if not party_id:
                    continue
                result = await conn.execute('UPDATE candidates SET party_id=$1 WHERE election_id=$2 AND constituency_id=$3 AND position=$4', party_id, election_id, const['id'], position)
                updated += int(result.rsplit(' ', 1)[-1])
        print(f'{year}: updated {updated} winner/runner rows')
    await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
