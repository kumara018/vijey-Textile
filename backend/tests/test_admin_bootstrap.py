"""
The admin bootstrap must not undo the owner's password.

WHY THIS EXISTS. `_ensure_admin()` ran on every startup and re-hashed
`ADMIN_PASSWORD` over the existing admin's password every time. The intent was
"never be locked out after a redeploy". The effect was that a shopkeeper who
changed their password from the account page — the correct thing to do with the
default that ships in the source — had it silently reverted by the next deploy,
the next Render restart, or a crash-loop recovery.

Worse: the value it reverted TO is the default written in main.py, which is
public in this repository. On any deploy where ADMIN_PASSWORD was not set on the
host, the admin account quietly went back to a credential anyone reading the
code can see.

Nothing caught it because the function did exactly what its docstring said. The
docstring was the bug.
"""
import os
from datetime import datetime, timedelta, timezone

import pytest


@pytest.fixture()
def admin_row(db):
    """The bootstrapped admin, whatever this shop calls it."""
    import main
    import models

    main._ensure_admin()
    db.expire_all()
    email = os.getenv("ADMIN_EMAIL") or _default_admin_email()
    row = db.query(models.User).filter(models.User.email == email).one()
    return row


def _default_admin_email() -> str:
    """Read the shop's own default out of main.py rather than hard-coding it."""
    import main
    import re

    src = open(main.__file__, encoding="utf-8").read()
    return re.search(r'os\.getenv\("ADMIN_EMAIL",\s*"([^"]+)"\)', src).group(1)


class TestThePasswordSurvives:
    def test_a_changed_password_is_not_reverted_on_the_next_boot(self, db, admin_row):
        """
        The regression this file exists for.

        Simulates the real sequence: the owner changes their password, the
        service restarts, and the bootstrap runs again.
        """
        import main
        from auth import hash_password, verify_password

        owners_password = "the-owner-chose-this-one-42"
        admin_row.password_hash = hash_password(owners_password)
        db.commit()

        main._ensure_admin()          # a redeploy, a restart, a crash recovery
        db.expire_all()

        assert verify_password(owners_password, admin_row.password_hash), (
            "the admin bootstrap overwrote a password the owner had set — "
            "their change did not stick, and the retired password works again"
        )

    def test_the_flags_that_lock_a_shopkeeper_out_are_still_repaired(self, db, admin_row):
        """
        The half that was worth keeping. None of these is something an owner
        sets deliberately, and any one of them makes the shop unrunnable.
        """
        import main

        admin_row.is_admin = False
        admin_row.is_active = False
        admin_row.is_verified = False
        admin_row.is_deactivated = True
        admin_row.scheduled_delete_at = datetime.now(timezone.utc) + timedelta(days=3)
        db.commit()

        main._ensure_admin()
        db.expire_all()

        assert admin_row.is_admin is True
        assert admin_row.is_active is True
        assert admin_row.is_verified is True
        assert admin_row.is_deactivated is False
        assert admin_row.scheduled_delete_at is None


class TestTheRecoveryHatch:
    def test_an_explicit_reset_flag_does_re_sync_the_password(self, db, admin_row, monkeypatch):
        """
        Losing the password must still be recoverable — deliberately, once,
        by someone who asked for it.
        """
        import main
        from auth import hash_password, verify_password

        admin_row.password_hash = hash_password("something-forgotten")
        db.commit()

        monkeypatch.setenv("ADMIN_PASSWORD", "recovered-by-hand-77")
        monkeypatch.setenv("ADMIN_PASSWORD_RESET", "true")

        main._ensure_admin()
        db.expire_all()

        assert verify_password("recovered-by-hand-77", admin_row.password_hash), (
            "ADMIN_PASSWORD_RESET was set and the password was not re-synced — "
            "the recovery path is broken"
        )

    def test_the_flag_is_off_unless_it_says_yes(self, db, admin_row, monkeypatch):
        """A stray or empty value must not trigger a reset."""
        import main
        from auth import hash_password, verify_password

        admin_row.password_hash = hash_password("still-mine")
        db.commit()

        for value in ("", "false", "no", "0", "maybe"):
            monkeypatch.setenv("ADMIN_PASSWORD_RESET", value)
            main._ensure_admin()
            db.expire_all()
            assert verify_password("still-mine", admin_row.password_hash), (
                f"ADMIN_PASSWORD_RESET={value!r} triggered a password reset"
            )
