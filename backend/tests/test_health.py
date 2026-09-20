"""
Healthy has to mean the shop can answer a customer.

WHY THIS EXISTS. On 20 September 2026 the hosted database refused every
connection — "Your account or project has exceeded the quota" — so every
product, order and sign-in returned a 500. /health never touched the database
and kept answering 200, so the container was marked healthy, the deploy script
declared success, and nothing raised a word. The shop served an empty
catalogue and a person had to notice.

These tests make a health check that cannot fail impossible to ship again.
Identical in both shops.
"""
import pytest


def test_health_reports_the_database(client):
    r = client.get('/health')
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['status'] == 'healthy'
    assert body['database'] == 'ok', 'health does not look at the database at all'


def test_health_fails_when_the_database_is_unreachable(client, monkeypatch):
    """The exact outage: connections refused, /health must say so."""
    import main

    class _Dead:
        def connect(self):
            raise OSError('connection to server failed: quota exceeded')

    main._DB_CHECK.update(at=0.0, ok=False, detail='reset')
    monkeypatch.setattr(main, 'engine', _Dead())

    r = client.get('/health')
    assert r.status_code == 503, 'a dead database still reported healthy'
    body = r.json()
    assert body['status'] == 'degraded'
    assert 'quota' in body['database'], 'the reason was not passed on'

    main._DB_CHECK.update(at=0.0, ok=False, detail='reset')   # unpoison the cache


def test_liveness_is_separate_so_an_outage_cannot_block_a_deploy(client):
    """
    The container healthcheck and deploy script use this one: a database
    outage must not restart a working process, nor block the deploy that
    might be carrying the fix.
    """
    r = client.get('/health/live')
    assert r.status_code == 200, r.text
    assert r.json()['status'] == 'alive'


def test_the_app_starts_with_the_database_down(monkeypatch):
    """
    Startup used to run every database step bare, so an unreachable database
    killed the process before it served one request — a 502 from the edge,
    with no API left to say what was wrong, restarting in a loop over
    something no restart could fix.

    It must start, and /health must be the thing that reports the fault.
    """
    import asyncio
    import main

    for name in ('_migrate_db', '_ensure_indexes', '_cleanup_deleted_accounts',
                 '_ensure_admin', '_ensure_products', '_clear_dead_image_paths',
                 '_print_integration_banner'):
        monkeypatch.setattr(main, name, lambda *a, **k: (_ for _ in ()).throw(
            OSError('connection refused: quota exceeded')))
    monkeypatch.setattr(main, '_try_take_scheduler_lease',
                        lambda: (_ for _ in ()).throw(OSError('connection refused')))

    class _Dead:
        def connect(self):
            raise OSError('connection refused: quota exceeded')

    monkeypatch.setattr(main.Base.metadata, 'create_all',
                        lambda *a, **k: (_ for _ in ()).throw(OSError('connection refused')))
    monkeypatch.setattr(main, 'engine', _Dead())

    # Wrapped the way Starlette wraps an async-generator lifespan.
    from contextlib import asynccontextmanager
    started = asynccontextmanager(main.lifespan)

    async def run():
        async with started(main.app):
            return True

    assert asyncio.run(run()) is True, 'the API refused to start without a database'
    main._DB_CHECK.update(at=0.0, ok=False, detail='reset')


def test_the_database_answer_is_cached_briefly(client, monkeypatch):
    """
    /health is polled by the container every 60s and by every open tab. One
    round trip per caller would be load for no extra truth.
    """
    import main
    main._DB_CHECK.update(at=0.0, ok=False, detail='reset')
    calls = {'n': 0}
    real = main.engine

    class _Counting:
        def connect(self):
            calls['n'] += 1
            return real.connect()

    monkeypatch.setattr(main, 'engine', _Counting())
    for _ in range(5):
        assert client.get('/health').status_code == 200
    assert calls['n'] == 1, f'the database was asked {calls["n"]} times for 5 checks'
