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
