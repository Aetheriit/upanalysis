"""Resumable standalone evidence scan: python -m app.services.prediction.evidence_worker.

Runs outside the API process; each completed AC is transactionally checkpointed.
No election tables are written. Resume the same snapshot after interruption.
"""
import argparse
import asyncio
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

from sqlalchemy import select

from app.core.database import async_session
from app.models.constituency import Constituency
from app.models.election import Election
from app.services.prediction.evidence import artifact_dir, connect, create_scan, dump, scan_info, scan_seat, utcnow


async def constituencies():
    async with async_session() as db:
        result = await db.execute(select(Constituency.code, Constituency.name, Constituency.district)
                                  .join(Election).where(Election.year == 2022))
        return sorted([dict(row._mapping) for row in result], key=lambda row: int(row["code"]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume")
    parser.add_argument("--derive-from", help="Create a new immutable snapshot from a completed corpus")
    parser.add_argument("--refresh-code", action="append", help="Re-search this AC in the derived snapshot")
    parser.add_argument("--workers", type=int, default=2, choices=(1, 2, 3))
    args = parser.parse_args()
    if args.resume and args.derive_from:
        raise ValueError("Resume and derive-from are mutually exclusive")
    if args.derive_from:
        with connect() as db:
            parent = db.execute("SELECT manifest,status FROM scans WHERE id=?", (args.derive_from,)).fetchone()
            prior_rows = db.execute("SELECT code,payload FROM seat_evidence WHERE snapshot_id=?", (args.derive_from,)).fetchall()
        if not parent or parent[1] not in {"completed", "completed_with_errors"} or not args.refresh_code:
            raise ValueError("A completed parent and at least one refresh-code are required")
        if any(code not in {str(i) for i in range(1, 404)} for code in args.refresh_code):
            raise ValueError("Invalid refresh constituency code")
        scan_id, manifest = create_scan(json.loads(parent[0])["constituencies"])
        manifest.update(parent_snapshot_id=args.derive_from, refreshed_codes=args.refresh_code,
                        inherited_query_version=json.loads(parent[0])["query_version"])
        with connect() as db:
            db.execute("UPDATE scans SET manifest=? WHERE id=?", (dump(manifest), scan_id))
            db.executemany("INSERT INTO seat_evidence VALUES (?,?,?)",
                           [(scan_id, code, payload) for code, payload in prior_rows if code not in args.refresh_code])
    elif args.resume:
        with connect() as db:
            record = db.execute("SELECT manifest,status FROM scans WHERE id=?", (args.resume,)).fetchone()
        if not record or record[1] not in {"running", "interrupted"}:
            raise ValueError("Only incomplete snapshots can be resumed; completed snapshots are immutable")
        scan_id, manifest = args.resume, json.loads(record[0])
    else:
        scan_id, manifest = create_scan(asyncio.run(constituencies()))
    with connect() as db:
        done = {row[0] for row in db.execute("SELECT code FROM seat_evidence WHERE snapshot_id=?", (scan_id,))}
    pending = [row for row in manifest["constituencies"] if str(row["code"]) not in done]
    print(dump({"snapshot_id": scan_id, "resume_completed": len(done), "remaining": len(pending)}), flush=True)
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(scan_seat, row, manifest["cutoff"]): row for row in pending}
        for future in as_completed(futures):
            result = future.result()
            with connect() as db:
                db.execute("INSERT INTO seat_evidence VALUES (?,?,?)", (scan_id, str(result["code"]), dump(result)))
            done.add(str(result["code"]))
            print(dump({"completed": len(done), "code": result["code"], "status": result["status"], "items": len(result["items"])}), flush=True)
    with connect() as db:
        payloads = db.execute("SELECT payload FROM seat_evidence WHERE snapshot_id=? ORDER BY code", (scan_id,)).fetchall()
        manifest["content_sha256"] = hashlib.sha256("\n".join(row[0] for row in payloads).encode()).hexdigest()
        partial = any(json.loads(row[0])["status"] != "complete" for row in payloads)
        db.execute("UPDATE scans SET status=?,completed_at=?,manifest=? WHERE id=?",
                   ("completed_with_errors" if partial else "completed", utcnow(), dump(manifest), scan_id))
    print(dump(scan_info(scan_id)), flush=True)


if __name__ == "__main__":
    import fcntl
    artifact_dir().mkdir(parents=True, exist_ok=True)
    with (artifact_dir() / "evidence.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        main()
