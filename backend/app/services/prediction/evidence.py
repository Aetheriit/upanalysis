"""Public-news discovery and auditable snapshots, never a sentiment poll.

Only RSS metadata is retained by the built-in adapter. Headlines cannot supply
party-impact scores. A separately configured, validated extraction adapter may
provide those. Retrieval and scoring coverage are deliberately separate.
"""
from __future__ import annotations

import hashlib
import ipaddress
import html
import json
import os
import re
import sqlite3
import time
import uuid
import xml.etree.ElementTree as ET
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl
from urllib.request import Request, urlopen

PARTIES = ("BJP", "SP", "BSP", "RLD", "INC", "IPT")
TAXONOMY = {
    "protest": ("protest", "agitation", "demonstration", "विरोध", "प्रदर्शन", "धरना"),
    "education": ("ugc", "education", "exam", "paper leak", "यूजीसी", "परीक्षा", "शिक्षा"),
    "livelihoods": ("unemployment", "jobs", "inflation", "बेरोजगार", "रोजगार", "महंगाई"),
    "agriculture": ("farmer", "sugarcane", "crop", "किसान", "गन्ना"),
    "infrastructure": ("road", "electricity", "flood", "पानी", "बाढ़", "सड़क", "बिजली"),
    "party_change": ("defect", "joins", "alliance", "गठबंधन", "दलबदल"),
    "election": ("election", "2027", "by-poll", "bypoll", "चुनाव", "विधानसभा"),
    "public_safety": ("violence", "riot", "crime", "हिंसा", "दंगा", "अपराध"),
}


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def artifact_dir():
    return Path(os.getenv("PREDICTION_ARTIFACT_DIR", "uploads/prediction"))


@contextmanager
def connect():
    root = artifact_dir()
    root.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(root / "evidence.sqlite3", timeout=30)
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, status TEXT NOT NULL,
          created_at TEXT NOT NULL, completed_at TEXT, manifest TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS seat_evidence (snapshot_id TEXT NOT NULL, code TEXT NOT NULL,
          payload TEXT NOT NULL, PRIMARY KEY(snapshot_id,code));
        CREATE TABLE IF NOT EXISTS context_sources (name TEXT PRIMARY KEY, payload TEXT NOT NULL);
    """)
    try:
        with db:
            yield db
    finally:
        db.close()


def dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False)


def safe_url(value):
    try:
        parsed = urlsplit(value)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            return None
        if parsed.hostname in {"localhost", "127.0.0.1", "::1"} or "." not in parsed.hostname:
            return None
        try:
            address = ipaddress.ip_address(parsed.hostname)
            if not address.is_global:
                return None
        except ValueError:
            pass
        query = [(key, val) for key, val in parse_qsl(parsed.query) if not key.lower().startswith("utm_")]
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), ""))
    except (TypeError, ValueError):
        return None


def normal(value):
    return " ".join(re.findall(r"\w+", str(value).casefold()))


def search_name(value):
    """Remove imported reference markers, not geographic identity."""
    return re.sub(r"\s*\[[a-zA-Z0-9]+\]", "", value).strip()


def timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
    if not parsed.tzinfo:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def freshness(items, now=None):
    now = now or datetime.now(timezone.utc)
    dates = [timestamp(item.get("published_at")) for item in items]
    dates = [value for value in dates if value and value <= now]
    if not dates:
        return "missing"
    age = (now - max(dates)).total_seconds() / 86400
    return "fresh" if age <= 7 else "aging" if age <= 30 else "stale"


def queries(seat, cutoff):
    # Do not infer an AC from district alone. Queries are retained verbatim.
    place = f'"{search_name(seat["name"])}" "{seat["district"]}" Uttar Pradesh'
    dates = f'after:2024-01-01 before:{cutoff[:10]}'
    return [
        ("political", "en", f'{place} (election OR BJP OR Samajwadi OR BSP OR Congress OR RLD OR alliance) {dates}'),
        ("local_events", "en", f'{place} (protest OR UGC OR farmer OR unemployment OR flood OR crime OR development) {dates}'),
        ("hindi", "hi", f'{place} (चुनाव OR विरोध OR प्रदर्शन OR किसान OR रोजगार OR यूजीसी) {dates}'),
    ]


def fetch_rss(query, language):
    url = "https://news.google.com/rss/search?" + urlencode({
        "q": query, "hl": f"{language}-IN", "gl": "IN", "ceid": f"IN:{language}"})
    request = Request(url, headers={"User-Agent": "UPPredictionEvidence/1.0 (+public RSS metadata only)"})
    for attempt in range(3):
        try:
            with urlopen(request, timeout=20) as response:
                data = response.read(2_000_001)
            if len(data) > 2_000_000 or b"<!ENTITY" in data.upper() or b"<!DOCTYPE" in data.upper():
                raise ValueError("invalid_feed")
            return ET.fromstring(data).findall("./channel/item")
        except HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise
            time.sleep(min(30, 3 * 2 ** attempt))
        except (TimeoutError, OSError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    return []


def parse_item(element, seat, cutoff, family):
    title = html.unescape(element.findtext("title", "")).strip()[:400]
    link = safe_url(element.findtext("link", ""))
    published = timestamp(element.findtext("pubDate", ""))
    source = element.find("source")
    publisher = source.text if source is not None else "Unknown"
    publisher_url = safe_url(source.get("url", "")) if source is not None else None
    if not title or not link or not published or published > timestamp(cutoff) or published.year < 2024:
        return None
    # Place name alone can refer to a city, district or parliament seat. Never
    # claim AC attribution from a query or a name mention alone.
    text = normal(title)
    has_place = normal(search_name(seat["name"])) in text
    has_district = normal(seat["district"]) in text
    ac_marker = any(marker in text for marker in ("assembly", "विधानसभा"))
    scope = "constituency" if has_place and ac_marker else "district" if has_district else "unknown"
    tags = [tag for tag, terms in TAXONOMY.items() if any(term in text for term in terms)]
    headline = title.rsplit(" - ", 1)[0]
    identity = hashlib.sha256(link.encode()).hexdigest()
    return {
        "id": identity[:24], "canonical_url_hash": identity, "url": link,
        "headline": headline, "publisher": publisher or "Unknown", "publisher_url": publisher_url,
        "published_at": published.isoformat(), "retrieved_at": utcnow(),
        "geo_scope": scope, "geography_status": "headline_match_requires_review",
        "constituency_code": str(seat["code"]), "issue_tags": tags,
        "source_type": "news_search", "content_basis": "rss_headline_only",
        "content_hash": hashlib.sha256(headline.encode()).hexdigest(),
        "query_family": family, "party_impacts": {}, "review_status": "unreviewed",
        "caveat": "Discovery metadata; full article and electoral implications have not been verified.",
    }


def cluster_items(items):
    """Precision-first headline/URL dedupe; no claim of complete syndication detection."""
    unique = {}
    for item in items:
        unique.setdefault(item["canonical_url_hash"], dict(item))
    clusters = []
    for item in sorted(unique.values(), key=lambda value: value["id"]):
        tokens = set(normal(item["headline"]).split())
        matched = None
        for existing in clusters:
            other = set(normal(existing[0]["headline"]).split())
            if len(tokens & other) / max(len(tokens | other), 1) >= 0.70:
                matched = existing
                break
        if matched is None:
            clusters.append([item])
        else:
            matched.append(item)
    output = []
    for members in clusters:
        cluster_id = hashlib.sha256("|".join(item["id"] for item in members).encode()).hexdigest()[:20]
        for item in members:
            item.update(cluster_id=cluster_id, duplicate_count=len(members), independence_status="unverified")
            output.append(item)
    return sorted(output, key=lambda item: item["published_at"], reverse=True)


def scan_seat(seat, cutoff):
    items, audit = [], []
    for family, language, query in queries(seat, cutoff):
        started = utcnow()
        try:
            fetched = fetch_rss(query, language)
            accepted = [parse_item(item, seat, cutoff, family) for item in fetched]
            accepted = [item for item in accepted if item]
            items.extend(accepted)
            audit.append({"family": family, "language": language, "query": query, "at": started,
                          "status": "ok", "returned": len(fetched), "accepted": len(accepted)})
        except Exception as error:
            # URLs, headers and provider keys never enter error messages.
            audit.append({"family": family, "language": language, "query": query, "at": started,
                          "status": "failed", "error_type": type(error).__name__})
        time.sleep(0.75)
    items = cluster_items(items)
    failed = sum(item["status"] == "failed" for item in audit)
    return {**seat, "queries": audit, "items": items, "retrieved_at": utcnow(),
            "status": "failed" if failed == len(audit) else "partial" if failed else "complete",
            "freshness": freshness(items), "cluster_count": len({item["cluster_id"] for item in items}),
            "scoring_status": "not_scored", "quality": 0,
            "limitations": ["Search results are not representative polling.",
                "Headline discovery does not establish event severity, party impact or constituency attribution.",
                "No verified party-impact extraction: atmosphere weight remains zero."]}


def create_scan(seats):
    codes = [str(row["code"]) for row in seats]
    if len(codes) != 403 or set(codes) != {str(i) for i in range(1, 404)}:
        raise ValueError("Expected exactly 403 unique canonical UP assembly codes (1–403)")
    scan_id = str(uuid.uuid4())
    manifest = {"cutoff": utcnow(), "expected": 403, "provider": "google_news_public_rss",
                "query_version": "up-ac-news-v2-clean-reference-markers", "metadata_only": True,
                "constituencies": seats, "party_impact_provider_configured": bool(os.getenv("PREDICTION_ATMOSPHERE_API_URL"))}
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM scans WHERE status='running' LIMIT 1").fetchone():
            raise ValueError("An evidence scan is already running; resume it instead")
        db.execute("INSERT INTO scans VALUES (?,?,?,?,?)", (scan_id, "running", utcnow(), None, dump(manifest)))
    return scan_id, manifest


def scan_info(scan_id=None):
    with connect() as db:
        row = db.execute("SELECT * FROM scans WHERE id=?", (scan_id,)).fetchone() if scan_id else db.execute("SELECT * FROM scans ORDER BY created_at DESC LIMIT 1").fetchone()
        if not row:
            return {"status": "not_started", "expected": 403, "completed": 0}
        records = [json.loads(value[0]) for value in db.execute("SELECT payload FROM seat_evidence WHERE snapshot_id=?", (row[0],))]
    manifest = json.loads(row[4])
    return {"snapshot_id": row[0], "status": row[1], "created_at": row[2], "completed_at": row[3],
            "cutoff": manifest["cutoff"], "expected": manifest["expected"], "completed": len(records),
            "seats_with_results": sum(bool(item["items"]) for item in records),
            "scored_seats": sum(item.get("scoring_status") == "scored" for item in records),
            "queries_ok": sum(q["status"] == "ok" for item in records for q in item["queries"]),
            "queries_failed": sum(q["status"] == "failed" for item in records for q in item["queries"]),
            "items": sum(len(item["items"]) for item in records),
            "unique_urls": len({i["canonical_url_hash"] for r in records for i in r["items"]}),
            "freshness_counts": dict(Counter(freshness(item["items"]) for item in records)),
            "provider": manifest["provider"], "metadata_only": manifest["metadata_only"],
            "parent_snapshot_id": manifest.get('parent_snapshot_id'),
            "refreshed_codes": manifest.get('refreshed_codes', []),
            "query_version": manifest['query_version'],
            "query_time_range": {'first': min((q['at'] for item in records for q in item['queries']), default=None),
                                 'last': max((q['at'] for item in records for q in item['queries']), default=None)},
            "content_sha256": manifest.get("content_sha256")}


def get_seat_evidence(code, snapshot_id=None):
    with connect() as db:
        scan = db.execute("SELECT id,manifest FROM scans WHERE id=?", (snapshot_id,)).fetchone() if snapshot_id else db.execute("SELECT id,manifest FROM scans ORDER BY created_at DESC LIMIT 1").fetchone()
        if not scan:
            return {"code": code, "status": "not_started", "items": [], "queries": [], "freshness": "missing"}
        record = db.execute("SELECT payload FROM seat_evidence WHERE snapshot_id=? AND code=?", (scan[0], str(code))).fetchone()
    result = json.loads(record[0]) if record else {"code": code, "status": "pending", "items": [], "queries": []}
    return {**result, "snapshot_id": scan[0], "cutoff": json.loads(scan[1])["cutoff"], "freshness": freshness(result["items"])}
