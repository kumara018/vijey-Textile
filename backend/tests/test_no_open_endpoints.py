"""
No unauthenticated route may act on the shop's behalf.

WHY THIS EXISTS. Four debug endpoints shipped to production and stayed there:

    GET /seed               reseeded the product catalogue
    GET /reset-admin        touched the admin account
    GET /test-notification  emailed any address given in the query string
    GET /test-email         the same, with the shop's branding

All four answered 200 to anybody on the internet. The last two are the reason
this file exists: they were an open mail relay. Anyone could make the shop send
a message of the shop's choosing to any address, and after the domain was
authenticated in Brevo that mail passed SPF and DKIM — so it would arrive in
inboxes wearing the shop's name. That is a phishing tool with the shop's
reputation attached, and it would have burned the sending domain.

The danger grew as the shop got healthier. Before the DNS work these messages
would have been filtered as forgeries; afterwards they were trusted.

A test rather than a comment, because the next debug endpoint will be added in
good faith by somebody solving a real problem at eleven at night, and the only
thing that will stop it reaching production is a failing build.
"""

import pytest


#: Paths that must never exist unauthenticated. Extend when a new one is
#: proposed — and if it genuinely must exist, put it behind get_current_admin
#: and it will not appear here at all.
FORBIDDEN = ["/seed", "/reset-admin", "/test-notification", "/test-email"]


class TestNoOpenDebugEndpoints:
    @pytest.mark.parametrize("path", FORBIDDEN)
    def test_the_route_does_not_exist(self, app, path):
        registered = {getattr(r, "path", None) for r in app.routes}
        assert path not in registered, (
            f"{path} is registered. If it is needed, gate it behind "
            f"auth_utils.get_current_admin — it must not be reachable anonymously."
        )

    @pytest.mark.parametrize("path", FORBIDDEN)
    def test_an_anonymous_request_is_refused(self, client, path):
        res = client.get(path)
        assert res.status_code in (404, 401, 403), (
            f"{path} answered {res.status_code} to an anonymous caller"
        )

    def test_nothing_anonymous_can_send_mail(self, app):
        """
        The specific harm: a route that takes a recipient and sends to it.

        Any endpoint accepting a `to` parameter without authentication is a
        relay, whatever it is called.
        """
        import inspect

        offenders = []
        for route in app.routes:
            endpoint = getattr(route, "endpoint", None)
            path = getattr(route, "path", "")
            if not endpoint or not path.startswith("/"):
                continue
            if path.startswith(("/api/",)):
                continue          # the API routers carry their own auth
            try:
                params = inspect.signature(endpoint).parameters
            except (ValueError, TypeError):
                continue
            if "to" in params or "email" in params:
                offenders.append(path)

        assert not offenders, (
            f"these take a recipient and are not behind the API's auth: {offenders}"
        )
