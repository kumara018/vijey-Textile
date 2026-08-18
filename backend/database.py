from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ammalu_tex.db")

# Neon (and some other hosts) give "postgres://" but SQLAlchemy 2.x needs "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ── Connection pool ──────────────────────────────────────────────────────────
#
# THE POOL WAS THE BOTTLENECK, AND IT WAS MEASURED RATHER THAN GUESSED.
#
# `pool_size=5, max_overflow=10` allows fifteen database operations at once.
# FastAPI runs every non-async endpoint — which is all of them here — in a
# threadpool of forty, so at any real concurrency twenty-five requests are
# holding a thread and waiting for a connection, with the default 30-second
# timeout. That is not a slowdown, it is a queue.
#
# Measured against the catalogue with `loadtest.py`, before this change:
#
#      1 visitor    156 req/s   p50    6ms
#      5 visitors   102 req/s   p50   27ms
#     50 visitors     2 req/s   p50 15082ms
#
# Throughput does not degrade at fifty; it collapses, and the median request
# takes fifteen seconds. A single WhatsApp forward putting fifty people on the
# catalogue at once would have looked, to every one of them, like the shop was
# down.
#
# The pool now matches the threadpool, so a thread never waits on a connection
# that structurally cannot exist. Forty connections from one instance sits well
# inside Render's free Postgres allowance of about ninety-seven — enough
# headroom for a second instance and the scheduled jobs. If this is ever scaled
# past two instances, that number is the one to check.
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))

if DATABASE_URL.startswith("sqlite"):
    # SQLite — local development and the test suite.
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 15},
        pool_size=POOL_SIZE,
        max_overflow=MAX_OVERFLOW,
        # Fail fast rather than hold a request thread for half a minute. A
        # customer would have abandoned the page long before 30s, so the wait
        # buys nothing and costs a thread that could be serving someone else.
        pool_timeout=10,
    )

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        """
        Write-ahead logging, so a write does not block every reader.

        In SQLite's default rollback-journal mode a single write takes an
        exclusive lock on the whole database, and every concurrent read waits
        behind it. That is the local mirror of the production problem above and
        it makes local load numbers meaningless. WAL lets readers carry on
        while a write is in flight, which is how Postgres behaves and therefore
        what the local measurement should be modelling.
        """
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA busy_timeout=15000")
        cur.close()
else:
    # PostgreSQL (Neon / Render / Supabase)
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,   # detect stale connections automatically
        pool_recycle=300,     # recycle connections every 5 minutes
        pool_size=POOL_SIZE,
        max_overflow=MAX_OVERFLOW,
        pool_timeout=10,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
