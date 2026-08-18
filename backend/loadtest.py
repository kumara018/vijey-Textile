"""
What does this API actually hold?

Nobody had measured. The shop is going live on Render's smallest instance and
the only performance evidence in the repo was frame rates in a browser — which
say nothing about whether the catalogue survives a WhatsApp forward landing
fifty people on it at once.

WHAT THIS MEASURES AND WHAT IT DOES NOT. Run against a local server it measures
the APPLICATION: query shapes, serialisation, per-request overhead. It does not
measure Render — different CPU, a network hop, Postgres instead of SQLite, and a
cold start if the instance was asleep. Treat the local numbers as the floor of
what the code costs and the ceiling of what the hosting can deliver. Pointing
`--url` at the deployed API measures the real thing, and takes the free tier's
cold start on the first request.

THE MIX IS THE SHOP'S, NOT A BENCHMARK'S. Hammering one endpoint at maximum
concurrency produces a big number and answers no question anyone has. Real
traffic to a clothing shop is overwhelmingly browsing: a catalogue page, a
couple of product views, occasionally a cart. The weights below are that shape,
so the result describes a busy afternoon rather than a synthetic peak.

    python loadtest.py --url http://localhost:8000 --users 50 --seconds 20
"""
from __future__ import annotations

import argparse
import asyncio
import random
import statistics
import sys
import time
from collections import defaultdict

try:
    import httpx
except ImportError:  # pragma: no cover
    sys.exit("loadtest needs httpx:  pip install httpx")


# (weight, label, path builder). Weights are relative, not percentages.
JOURNEY = [
    (50, "catalogue",      lambda ids: "/api/products/?limit=24"),
    (15, "catalogue+sort", lambda ids: "/api/products/?limit=24&sort_by=price&sort_order=asc"),
    (10, "by category",    lambda ids: "/api/products/?category=Baby%20Frocks&limit=24"),
    (20, "product detail", lambda ids: f"/api/products/{random.choice(ids)}" if ids else "/api/products/?limit=1"),
    (5,  "categories",     lambda ids: "/api/products/categories"),
]

# Anything at or above this is worth a person's attention. 500ms is roughly
# where a page stops feeling like it responded to the tap.
#
# Treat a breach as "look at this", not "the site is broken". The bar is
# absolute rather than relative to the machine, and a development laptop running
# a browser, two dev servers and a build alongside a single uvicorn worker will
# cross it at concurrencies a Render instance would not. Measured here across
# three consecutive identical runs at 50 visitors: 137, 99 and 113 req/s — a
# 38% spread from run to run with no code change between them, which is the
# noise floor to keep in mind before reading anything into a single number.
SLOW_MS = 500


async def discover_product_ids(base: str) -> list[int]:
    async with httpx.AsyncClient(base_url=base, timeout=30) as c:
        try:
            r = await c.get("/api/products/?limit=50")
            r.raise_for_status()
            data = r.json()
            items = data if isinstance(data, list) else data.get("products", [])
            return [p["id"] for p in items if isinstance(p, dict) and "id" in p]
        except Exception:
            return []


async def worker(c, ids, deadline, results, errors):
    """One simulated visitor, sharing the client's connection pool."""
    weights = [j[0] for j in JOURNEY]
    while time.perf_counter() < deadline:
        _, label, build = random.choices(JOURNEY, weights=weights, k=1)[0]
        path = build(ids)
        t0 = time.perf_counter()
        try:
            r = await c.get(path)
            results[label].append((time.perf_counter() - t0) * 1000)
            if r.status_code >= 400:
                errors[f"{label} {r.status_code}"] += 1
        except Exception as e:
            errors[f"{label} {type(e).__name__}"] += 1


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = min(len(ordered) - 1, int(round(p / 100 * (len(ordered) - 1))))
    return ordered[k]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--users", type=int, default=50, help="concurrent visitors")
    ap.add_argument("--seconds", type=int, default=20)
    args = ap.parse_args()

    ids = await discover_product_ids(args.url)
    print(f"target      {args.url}")
    print(f"visitors    {args.users} concurrent, for {args.seconds}s")
    print(f"catalogue   {len(ids)} products discovered\n")
    if not ids:
        print("  ! no products found — detail requests will fall back to the list\n")

    results: dict[str, list[float]] = defaultdict(list)
    errors: dict[str, int] = defaultdict(int)

    started = time.perf_counter()
    deadline = started + args.seconds

    # ONE client, shared, with keep-alive for every visitor.
    #
    # The first version gave each worker its own AsyncClient. That is not a
    # heavier load, it is a different and useless one: fifty independent pools
    # means a fresh TCP connection per request and fifty sockets in TIME_WAIT
    # per second, and on Windows the connect storm becomes the bottleneck. It
    # reported 1-2 req/s and 15-second medians while the server's own access log
    # said the same requests took 93ms — the queue was entirely in the load
    # generator. A tool that measures itself is worse than no tool, because the
    # number it prints looks like a finding.
    limits = httpx.Limits(max_connections=args.users * 2,
                          max_keepalive_connections=args.users * 2)
    async with httpx.AsyncClient(base_url=args.url, timeout=30, limits=limits) as client:
        await asyncio.gather(*[
            worker(client, ids, deadline, results, errors) for _ in range(args.users)
        ])
    elapsed = time.perf_counter() - started

    total = sum(len(v) for v in results.values())
    print(f"{'endpoint':18} {'n':>7} {'p50':>8} {'p95':>8} {'p99':>8} {'max':>8}")
    print("-" * 62)
    worst = 0.0
    for label, samples in sorted(results.items(), key=lambda kv: -len(kv[1])):
        p95 = percentile(samples, 95)
        worst = max(worst, p95)
        print(f"{label:18} {len(samples):>7} "
              f"{statistics.median(samples):>7.0f}ms {p95:>7.0f}ms "
              f"{percentile(samples, 99):>7.0f}ms {max(samples):>7.0f}ms")

    print("-" * 62)
    print(f"{total} requests in {elapsed:.1f}s  =  {total / elapsed:.0f} req/s "
          f"across {args.users} concurrent visitors")

    if errors:
        print("\nerrors:")
        for k, n in sorted(errors.items(), key=lambda kv: -kv[1]):
            print(f"  {n:>6}  {k}")
    else:
        print("no failed requests")

    # A non-zero exit so this can gate a deploy if anyone wants it to.
    if errors:
        print("\nFAIL — requests failed under load")
        return 1
    if worst >= SLOW_MS:
        print(f"\nFAIL — p95 reached {worst:.0f}ms, over the {SLOW_MS}ms bar")
        return 1
    print(f"\nOK — every endpoint's p95 is under {SLOW_MS}ms")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
