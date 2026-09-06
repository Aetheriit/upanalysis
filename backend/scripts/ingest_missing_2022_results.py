"""Import candidate totals for 2022 constituencies missing from booth files.

Source: Election Commission of India constituency result pages. Booth-level
records are not fabricated; this script stores only the published constituency
candidate totals and marks them as a source-recovery import in its output.
"""
import asyncio
import os
from io import StringIO

import asyncpg
import pandas as pd

MISSING_ACS = [119, 176, 177, 179, 187, 242, 295, 299, 321, 371, 381, 386, 389, 390]


def party_abbreviation(value):
    text = str(value or "").upper()
    mappings = (
        ("BHARATIYA JANATA", "BJP"), ("SAMAJWADI", "SP"),
        ("BAHUJAN SAMAJ", "BSP"), ("INDIAN NATIONAL CONGRESS", "INC"),
        ("ALL INDIA MAJLIS", "AIMIM"), ("SUHELDEV", "SBSP"),
        ("APNA DAL", "AD(S)"), ("RASHTRIYA LOK DAL", "RLD"),
        ("AAM AADMI", "AAP"), ("JANATA DAL", "JD(U)"),
        ("NISHAD", "NISHAD"), ("INDEPENDENT", "IND"), ("निर्दलीय", "IND"),
    )
    for marker, abbreviation in mappings:
        if marker in text:
            return abbreviation
    return text[:50] or "IND"


def read_result_rows(ac):
    url = f"https://results.eci.gov.in/ResultAcGenMar2022/ConstituencywiseS24{ac}.htm?ac={ac}"
    tables = pd.read_html(StringIO(__import__("urllib.request").request.urlopen(url, timeout=30).read().decode("utf-8", "ignore")))
    for table in tables:
        columns = [str(c).lower() for c in table.columns]
        if any("candidate" in c for c in columns) and any("total" in c for c in columns):
            candidate_col = next(c for c in table.columns if "candidate" in str(c).lower())
            party_col = next(c for c in table.columns if "party" in str(c).lower())
            total_col = next(c for c in table.columns if "total" in str(c).lower())
            rows = []
            for _, row in table.iterrows():
                name = str(row[candidate_col]).strip()
                if not name or name.lower() == "nan":
                    continue
                try:
                    votes = int(float(str(row[total_col]).replace(",", "").strip()))
                except ValueError:
                    continue
                rows.append((name, party_abbreviation(row[party_col]), votes))
            if rows:
                return rows
    raise RuntimeError(f"No candidate result table found for AC {ac}: {url}")


async def main():
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/election_intel")
    conn = await asyncpg.connect(database_url.replace("postgresql+asyncpg://", "postgresql://", 1))
    election = await conn.fetchrow("SELECT id FROM elections WHERE year = 2022 LIMIT 1")
    if not election:
        raise RuntimeError("2022 election is not present in the database")

    for ac in MISSING_ACS:
        const = await conn.fetchrow("SELECT id, name FROM constituencies WHERE election_id=$1 AND code=$2", election["id"], str(ac))
        if not const:
            print(f"AC {ac}: constituency missing, skipped")
            continue
        rows = [r for r in read_result_rows(ac) if r[0].upper() not in ("NOTA", "NONE OF THE ABOVE")]
        total_votes = sum(r[2] for r in rows)
        rows.sort(key=lambda r: r[2], reverse=True)
        for position, (name, party, votes) in enumerate(rows, 1):
            party_id = await conn.fetchval("SELECT id FROM parties WHERE UPPER(abbreviation)=$1", party)
            if not party_id:
                party_id = await conn.fetchval("INSERT INTO parties (id,name,abbreviation,color,created_at) VALUES (gen_random_uuid(),$1,$2,'#94A3B8',NOW()) RETURNING id", party, party)
            candidate = await conn.fetchrow("SELECT id FROM candidates WHERE election_id=$1 AND constituency_id=$2 AND UPPER(name)=UPPER($3)", election["id"], const["id"], name)
            margin = rows[0][2] - rows[1][2] if position == 1 and len(rows) > 1 else votes - rows[0][2]
            values = (votes, round(votes / total_votes * 100, 2) if total_votes else 0, margin, position == 1, position, votes / total_votes * 100 < 16.67 if total_votes else False)
            if candidate:
                await conn.execute("UPDATE candidates SET party_id=$1,votes_received=$2,vote_share_pct=$3,margin=$4,is_winner=$5,position=$6,deposit_lost=$7 WHERE id=$8", party_id, *values, candidate["id"])
            else:
                await conn.execute("INSERT INTO candidates (id,election_id,constituency_id,party_id,name,votes_received,vote_share_pct,margin,is_winner,position,deposit_lost,created_at) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())", election["id"], const["id"], party_id, name, *values)
        winner = rows[0] if rows else (None, None, 0)
        await conn.execute("UPDATE constituencies SET winner_name=$1,winner_party=$2,winning_margin=$3 WHERE id=$4", winner[0], winner[1], rows[0][2] - rows[1][2] if len(rows) > 1 else 0, const["id"])
        print(f"AC {ac} ({const['name']}): imported {len(rows)} candidates")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
