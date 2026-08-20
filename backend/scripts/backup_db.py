"""Dump every table to a timestamped JSON file.

WHY THIS EXISTS. Production runs on a free-tier Render PostgreSQL, and a free
Render database is DELETED after 90 days. There was no backup of any kind in
either shop — no pg_dump, no scheduled export, nothing. Real orders, customer
addresses, payment references and return requests sit in that database, and
the only copy was the one Render is on a clock to remove.

WHY NOT pg_dump. It needs the Postgres client tools installed and matching the
server's major version, which is a yak-shave on Windows at the moment somebody
actually needs a backup. This uses SQLAlchemy, which is already a dependency,
so it runs anywhere the app itself runs.

WHAT IT PRODUCES. One JSON file per run holding every row of every table, with
the schema's own column names. That restores into any Postgres — Render, Neon,
Supabase, a local one — and is readable without a database at all, which
matters if you are trying to find one customer's order in a hurry.

    cd backend
    python scripts/backup_db.py                     # writes ./backups/
    python scripts/backup_db.py --out D:/safe       # somewhere else
    DATABASE_URL="postgresql://..." python scripts/backup_db.py

RUN IT BEFORE ANY HOSTING CHANGE, and keep the file somewhere that is not the
host you are migrating away from.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import decimal
import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, inspect, text  # noqa: E402


def _encode(value):
    """Make a database value JSON-safe without losing precision."""
    if isinstance(value, (_dt.datetime, _dt.date, _dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        # str, not float: money must not round-trip through binary floating point.
        return str(value)
    if isinstance(value, (bytes, memoryview)):
        return bytes(value).hex()
    return value


def main() -> int:
    ap = argparse.ArgumentParser(description="Back up every table to JSON.")
    ap.add_argument("--out", default="backups", help="directory to write into")
    ap.add_argument("--url", default=os.getenv("DATABASE_URL"), help="database URL")
    ap.add_argument(
        "--keep", type=int, default=0,
        help="delete all but the newest N backups after writing (0 = keep all)",
    )
    args = ap.parse_args()

    url = args.url
    if not url:
        print("No DATABASE_URL. Pass --url or set the environment variable.")
        print("Copy it from Render → your database → Internal/External Database URL.")
        return 2
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    engine = create_engine(url)
    tables = inspect(engine).get_table_names()
    if not tables:
        print("Connected, but the database reports no tables. Nothing written.")
        return 1

    dump: dict[str, list[dict]] = {}
    total = 0
    with engine.connect() as conn:
        for t in sorted(tables):
            rows = [
                {k: _encode(v) for k, v in dict(r._mapping).items()}
                for r in conn.execute(text(f'SELECT * FROM "{t}"'))
            ]
            dump[t] = rows
            total += len(rows)
            print(f"  {t:26s} {len(rows):6d} rows")

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = _dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    path = out_dir / f"backup-{stamp}.json"
    path.write_text(json.dumps(dump, indent=1, ensure_ascii=False), encoding="utf-8")

    size_mb = path.stat().st_size / 1_048_576
    print(f"\n  {len(tables)} tables, {total} rows -> {path}  ({size_mb:.2f} MB)")
    # Retention. Without this a nightly backup eventually fills the disk,
    # which would take the shop down to protect data that was never at risk.
    if args.keep > 0:
        for stale in sorted(out_dir.glob("backup-*.json"), reverse=True)[args.keep:]:
            stale.unlink()
            print(f"  pruned {stale.name}")

    print("  Keep a copy somewhere that is NOT this machine.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
