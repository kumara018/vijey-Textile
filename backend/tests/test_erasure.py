"""
Erasure actually happens.

WHY THIS TEST EXISTS. `_cleanup_deleted_accounts()` was written, was correct,
and was called exactly once — at process start. It was never registered with
the scheduler, so the promise the account page makes ("after N days the account
is permanently deleted") was kept only when the service happened to restart
after the window had closed. On a host that keeps a process alive for weeks, a
customer who asked to be erased on the 1st was still in the database on the
20th.

Nothing caught it because every piece worked in isolation: the endpoint set the
deadline, the email went out, and the purge function deleted the right rows
when it ran. What was missing was the thing that makes it run, and no test
asserted that a scheduled job existed.

So there are two tests here, and the first is the one that would have caught
it: does the application actually schedule the erasure job at all.
"""
import importlib
from datetime import datetime, timedelta, timezone

import pytest


class TestErasureIsScheduled:
    def test_the_erasure_job_is_registered_on_the_scheduler(self):
        """
        The regression guard.

        This asserts on the wiring, not the behaviour, because the wiring is
        what was broken. A purge routine nothing calls on a timer is a purge
        routine that does not run.
        """
        main = importlib.import_module("main")
        source = open(main.__file__, encoding="utf-8").read()
        assert '_scheduler.add_job(_cleanup_deleted_accounts' in source, (
            "the account-erasure purge is not registered with the scheduler — "
            "it will only ever run at process start"
        )
        assert 'id="account_erasure"' in source, (
            "the erasure job needs a stable id so replace_existing can work "
            "across reloads"
        )

    def test_it_is_not_scheduled_so_often_that_it_polls_the_database(self):
        """
        The other half of the judgement: erasure is a daily obligation, not a
        real-time one. Waking the database every minute to find nothing is how
        a scheduled job becomes a cost centre.
        """
        main = importlib.import_module("main")
        source = open(main.__file__, encoding="utf-8").read()
        line = next(
            l for l in source.splitlines()
            if "_cleanup_deleted_accounts" in l and "add_job" in l
        )
        assert '"interval", hours=' in line, f"unexpected schedule: {line.strip()}"
        hours = int(line.split("hours=")[1].split(",")[0])
        assert hours >= 12, f"erasure runs every {hours}h — too often for a multi-day window"


class TestErasureDeletesTheRightRows:
    def test_an_account_past_its_deadline_is_deleted(self, db, make_user):
        import main
        import models

        user, _ = make_user(email="erase-me@test.local", phone="9000009971")
        row = db.query(models.User).filter(models.User.email == "erase-me@test.local").one()
        row.scheduled_delete_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()

        main._cleanup_deleted_accounts()

        db.expire_all()
        assert db.query(models.User).filter(
            models.User.email == "erase-me@test.local"
        ).first() is None, "an account past its deletion deadline survived the purge"

    def test_an_account_still_inside_its_window_is_left_alone(self, db, make_user):
        """
        The dangerous direction. A purge that is too eager deletes the account
        of somebody who changed their mind, and there is no undo.
        """
        import main
        import models

        user, _ = make_user(email="keep-me@test.local", phone="9000009972")
        row = db.query(models.User).filter(models.User.email == "keep-me@test.local").one()
        row.scheduled_delete_at = datetime.now(timezone.utc) + timedelta(days=6)
        db.commit()

        main._cleanup_deleted_accounts()

        db.expire_all()
        assert db.query(models.User).filter(
            models.User.email == "keep-me@test.local"
        ).first() is not None, "an account inside its grace period was deleted early"

    def test_an_account_with_no_deadline_is_never_touched(self, db, make_user):
        import main
        import models

        make_user(email="ordinary@test.local", phone="9000009973")
        main._cleanup_deleted_accounts()

        db.expire_all()
        assert db.query(models.User).filter(
            models.User.email == "ordinary@test.local"
        ).first() is not None, "an ordinary account was deleted by the erasure sweep"

    def test_running_the_sweep_twice_is_harmless(self, db, make_user):
        """
        Idempotence, because a scheduled job will be run again — on the next
        tick, on a redeploy, and by whichever worker takes the lease.
        """
        import main
        import models

        make_user(email="twice@test.local", phone="9000009974")
        row = db.query(models.User).filter(models.User.email == "twice@test.local").one()
        row.scheduled_delete_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()

        main._cleanup_deleted_accounts()
        main._cleanup_deleted_accounts()  # must not raise

        db.expire_all()
        assert db.query(models.User).filter(
            models.User.email == "twice@test.local"
        ).first() is None
