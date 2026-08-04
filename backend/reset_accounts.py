"""
ONE-TIME MAINTENANCE SCRIPT — wipes ALL user + admin accounts (and their
orders, cart items, addresses, reviews, wishlist items, return requests).

This is IRREVERSIBLE unless your database has a separate backup. It does
NOT create a new admin itself — after running this, set ADMIN_EMAIL,
ADMIN_PASSWORD, and ADMIN_PHONE as env vars (on Render for production, or
in backend/.env for local), then restart the backend. main.py's
_ensure_admin() runs on every startup and will auto-create the admin
fresh from those env vars since no user will exist with that email yet.

Run locally:
    cd backend
    venv\\Scripts\\activate      (Windows)  or  source venv/bin/activate (Mac/Linux)
    python reset_accounts.py

Run on Render (production):
    Render Dashboard -> vijey-textile backend service -> Shell tab
    python reset_accounts.py
    (This uses whatever DATABASE_URL is already set on that service —
    the script never sees or asks for the connection string directly.)
"""
from database import SessionLocal
import models


def main():
    db = SessionLocal()
    try:
        user_count  = db.query(models.User).count()
        order_count = db.query(models.Order).count()

        if user_count == 0:
            print("No users found. Nothing to delete.")
            return

        print(f"About to PERMANENTLY delete:")
        print(f"  {user_count} user account(s) (including all admins)")
        print(f"  {order_count} order(s) (and their cart items, addresses,")
        print(f"    reviews, wishlist items, and return requests)")
        print()
        confirm = input('Type "DELETE ALL" (exactly, case-sensitive) to proceed: ').strip()
        if confirm != "DELETE ALL":
            print("Cancelled. Nothing was deleted.")
            return

        # Orders must be deleted before users — Order.user_id has no
        # cascade-delete rule at the DB level (unlike cart/address/review/
        # wishlist, which do cascade), so deleting users first would fail
        # with a foreign-key violation for anyone who placed an order.
        deleted_orders = db.query(models.Order).delete(synchronize_session=False)
        deleted_users  = db.query(models.User).delete(synchronize_session=False)
        db.commit()

        print(f"Deleted {deleted_orders} order(s) and {deleted_users} user(s).")
        print()
        print("Next steps:")
        print("  1. Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_PHONE env vars")
        print("     (Render dashboard for production, or backend/.env locally).")
        print("  2. Restart the backend service.")
        print("  3. main.py will auto-create the new admin account on startup.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
