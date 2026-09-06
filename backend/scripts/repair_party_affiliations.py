"""Repair candidate party affiliations from local results and public result pages.

Local result CSVs are authoritative for winner/runner-up affiliations. For the
remaining candidates, the public constituency result pages provide the party
shown beside each candidate. This job changes party_id only; votes and results
are left untouched.
"""
import asyncio
import os
import re
import unicodedata
import urllib.request
from io import StringIO
from pathlib import Path

import asyncpg
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "https://election-analytics.ajaikumark.com/state/uttar-pradesh/{year}/{slug}/"


def slugify(value):
    value = unicodedata.normalize("NFKD", str(value)).encode("ascii", "ignore").decode()
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value


def clean_name(value):
    value = str(value or "").upper().replace("✓ WINNER", "")
    value = re.sub(r"\([^)]*\)", "", value)
    value = re.sub(r"[^A-Z0-9]+", "", value)
    return value


def party_abbreviation(value):
    text = str(value or "").strip().upper()
    mappings = (
        ("BHARATIYA JANATA", "BJP"), ("SAMAJWADI", "SP"),
        ("BAHUJAN SAMAJ", "BSP"), ("INDIAN NATIONAL CONGRESS", "INC"),
        ("ALL INDIA MAJLIS", "AIMIM"), ("SUHELDEV", "SBSP"),
        ("APNA DAL", "AD(S)"), ("RASHTRIYA LOK DAL", "RLD"),
        ("AAM AADMI", "AAP"), ("JANATA DAL", "JD(U)"),
        ("NISHAD", "NISHAD"), ("INDEPENDENT", "IND"),
        ("NONE OF THE ABOVE", "NOTA"), ("निर्दलीय", "IND"),
    )
    for marker, abbreviation in mappings:
        if marker in text:
            return abbreviation
    return text[:50] or "IND"


def read_page(year, slug):
    url = BASE_URL.format(year=year, slug=slug)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 ElectionIntelligenceDataAudit/1.0"})
    html = urllib.request.urlopen(request, timeout=25).read().decode("utf-8", "ignore")
    for table in pd.read_html(StringIO(html)):
        cols = [str(c).lower() for c in table.columns]
        if not any("candidate" in c for c in cols) or not any("party" in c for c in cols):
            continue
        candidate_col = next(c for c in table.columns if "candidate" in str(c).lower())
        party_col = next(c for c in table.columns if "party" in str(c).lower())
        vote_col = next((c for c in table.columns if "vote" in str(c).lower()), None)
        rows = []
        for _, row in table.iterrows():
            name = re.sub(r"✓\s*Winner", "", str(row[candidate_col]), flags=re.I).strip()
            if not name or name.lower() in ("nan", "none of the above"):
                continue
            votes = None
            if vote_col is not None:
                try:
                    votes = int(float(str(row[vote_col]).replace(",", "").strip()))
                except (TypeError, ValueError):
                    pass
            rows.append((clean_name(name), party_abbreviation(row[party_col]), votes))
        if rows:
            return rows
    raise RuntimeError("candidate/party table not found")


async def get_or_create_party(conn, cache, abbreviation):
    if abbreviation == "NOTA":
        return None
    if abbreviation not in cache:
        cache[abbreviation] = await conn.fetchval(
            "SELECT id FROM parties WHERE UPPER(abbreviation)=$1", abbreviation
        )
    if cache[abbreviation] is None:
        cache[abbreviation] = await conn.fetchval(
            "INSERT INTO parties (id,name,abbreviation,color,created_at) VALUES (gen_random_uuid(),$1,$2,'#94A3B8',NOW()) RETURNING id",
            abbreviation, abbreviation,
        )
    return cache[abbreviation]


async def main():
    database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/election_intel")
    conn = await asyncpg.connect(database_url.replace("postgresql+asyncpg://", "postgresql://", 1))
    parties = {r["abbreviation"].upper(): r["id"] for r in await conn.fetch("SELECT id, abbreviation FROM parties")}
    total_changed = 0
    total_unmatched = 0

    for year in (2017, 2022):
        constituencies = await conn.fetch(
            "SELECT co.id, co.name, co.code FROM constituencies co JOIN elections e ON e.id=co.election_id WHERE e.year=$1 ORDER BY co.code::int",
            year,
        )
        for const in constituencies:
            slug = slugify(const["name"])
            if year == 2022 and slug == "varanasi-cantt":
                slug = "varanasi-cantonment"
            try:
                source_rows = read_page(year, slug)
            except Exception as exc:
                print(f"{year} AC {const['code']} {const['name']}: source unavailable ({exc})")
                total_unmatched += 1
                continue
            candidates = await conn.fetch(
                "SELECT id,name,votes_received FROM candidates WHERE constituency_id=$1 AND election_id=(SELECT id FROM elections WHERE year=$2 LIMIT 1)",
                const["id"], year,
            )
            by_name = {}
            for candidate in candidates:
                by_name.setdefault(clean_name(candidate["name"]), []).append(candidate)
            changed = 0
            unmatched = 0
            for source_name, abbreviation, source_votes in source_rows:
                matches = by_name.get(source_name, [])
                if source_votes is not None and len(matches) > 1:
                    exact = [m for m in matches if m["votes_received"] == source_votes]
                    if exact:
                        matches = exact
                # Raw booth imports occasionally contain a truncated or
                # malformed candidate name. Published vote totals are unique
                # within a constituency in those cases, so use them as the
                # safe fallback instead of leaving the party as IND.
                if not matches and source_votes is not None:
                    matches = [m for m in candidates if m["votes_received"] == source_votes]
                if not matches or abbreviation == "NOTA":
                    unmatched += 1
                    continue
                party_id = await get_or_create_party(conn, parties, abbreviation)
                for candidate in matches[:1]:
                    await conn.execute("UPDATE candidates SET party_id=$1 WHERE id=$2", party_id, candidate["id"])
                    changed += 1
            total_changed += changed
            total_unmatched += unmatched
            print(f"{year} AC {const['code']} {const['name']}: changed {changed}, unmatched {unmatched}")

    await conn.close()
    print(f"TOTAL party assignments changed: {total_changed}; unresolved source rows: {total_unmatched}")


if __name__ == "__main__":
    asyncio.run(main())
