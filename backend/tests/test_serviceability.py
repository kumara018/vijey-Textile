"""
Do we deliver to this pincode — and the three answers that must stay distinct.

WHY THIS FILE EXISTS. The check called `/api/kinko/v1/invoice/charges/`, which
is the SHIPPING COST api. Delhivery scopes API access per endpoint and this
account is not authorised for charges, so every call returned 401, the caller
turned that into `checked: false`, and the shop told every customer who typed a
pincode "we will confirm delivery when you order". The feature was dead for the
whole time it shipped.

The token was never wrong. The same token, in the same header, against
`/c/api/pin-codes/json/` returns real data — proven from the production server.

Three outcomes have to stay apart, and collapsing any two is a real cost:

  SERVED        deliver, and say what is available there.
  NOT SERVED    a genuine no from the courier. Promising a delivery here means
                taking money for a parcel that cannot arrive.
  CANNOT ASK    the courier did not answer. Rendering this as a refusal loses
                an order the shop could have fulfilled.
"""

import json
from unittest.mock import patch

import pytest

import delhivery


@pytest.fixture()
def dl():
    """
    A separately loaded copy of `delhivery`.

    conftest replaces every public function in the real module with a mock for
    the whole session, so no test can reach a real courier. That protection is
    right, and it also means `check_serviceability` cannot be called directly
    here — a test that did would pass against a MagicMock while the real code
    called the wrong endpoint, which is precisely the bug this file exists to
    prevent. Loading a second instance leaves the session's stubs untouched.
    """
    import importlib.util
    spec = importlib.util.spec_from_file_location("delhivery_clean", delhivery.__file__)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _Resp:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture()
def token(monkeypatch):
    monkeypatch.setenv("DELHIVERY_API_TOKEN", "a" * 40)


class TestItAsksTheEndpointThatAnswersThisQuestion:
    def test_the_url_is_the_pincode_api_not_the_cost_api(self, dl, token):
        """
        The specific regression. `invoice/charges` answers "what would this
        parcel cost" and only implies serviceability as a side effect — and it
        is the endpoint this account cannot call.
        """
        seen = {}

        def capture(req, *a, **k):
            seen["url"] = req.full_url
            return _Resp({"delivery_codes": []})

        with patch.object(dl._req, "urlopen", side_effect=capture):
            dl.check_serviceability("638001", "600001")

        assert "/c/api/pin-codes/json/" in seen["url"]
        assert "invoice/charges" not in seen["url"]
        assert "filter_codes=600001" in seen["url"]

    def test_the_token_goes_in_the_header_delhivery_expects(self, dl, token):
        seen = {}

        def capture(req, *a, **k):
            seen["auth"] = req.get_header("Authorization")
            return _Resp({"delivery_codes": []})

        with patch.object(dl._req, "urlopen", side_effect=capture):
            dl.check_serviceability("638001", "600001")

        assert seen["auth"] == "Token " + "a" * 40


class TestTheThreeAnswersStayDistinct:
    #: The shape of a real reply, taken from production.
    SERVED = {"delivery_codes": [{"postal_code": {
        "pin": 600001, "country_code": "IN", "state_code": "TN",
        "cod": "Y", "pre_paid": "Y", "pickup": "Y", "district": "Chennai",
    }}]}

    def test_a_served_pincode_reports_what_is_available_there(self, dl, token):
        with patch.object(dl._req, "urlopen", return_value=_Resp(self.SERVED)):
            out = dl.check_serviceability("638001", "600001")

        assert out["serviceable"] is True
        assert out["district"] == "Chennai"
        assert out["cod"] is True and out["prepaid"] is True

    def test_an_empty_list_is_a_no_not_a_failure(self, dl, token):
        """
        Delhivery knows the pincode and does not serve it. That is an answer,
        and it must not be reported as "we could not ask".
        """
        with patch.object(dl._req, "urlopen", return_value=_Resp({"delivery_codes": []})):
            out = dl.check_serviceability("638001", "999999")

        assert out is not None, "an empty list is an answer, not a failure"
        assert out["serviceable"] is False

    def test_a_refused_call_is_a_shrug_not_a_no(self, dl, token):
        """
        None means "we could not ask". The router renders it as "we will
        confirm when you order" — never as a refusal, because telling somebody
        the shop cannot reach them over a failed API call loses a real order.
        """
        with patch.object(dl._req, "urlopen", side_effect=OSError("boom")):
            assert dl.check_serviceability("638001", "600001") is None

    def test_an_unconfigured_courier_is_also_a_shrug(self, dl, monkeypatch):
        monkeypatch.delenv("DELHIVERY_API_TOKEN", raising=False)
        assert dl.check_serviceability("638001", "600001") is None

    def test_cod_absent_is_read_as_no_rather_than_missing(self, dl, token):
        """A pincode that takes prepaid only must not offer cash on delivery."""
        payload = {"delivery_codes": [{"postal_code": {
            "pin": 682001, "cod": "N", "pre_paid": "Y", "pickup": "N", "district": "Kochi",
        }}]}
        with patch.object(dl._req, "urlopen", return_value=_Resp(payload)):
            out = dl.check_serviceability("638001", "682001")

        assert out["serviceable"] is True
        assert out["cod"] is False
        assert out["pickup"] is False


class TestTheFailureIsRecordedForTheHealthPage:
    def test_a_401_is_reported_as_a_rejected_token(self, dl, token):
        import urllib.error
        err = urllib.error.HTTPError("u", 401, "Unauthorized", None, None)
        with patch.object(dl._req, "urlopen", side_effect=err):
            dl.check_serviceability("638001", "600001")

        assert dl.LAST_COURIER["ok"] is False
        assert "401" in (dl.LAST_COURIER["detail"] or "")

    def test_a_success_clears_the_failure(self, dl, token):
        with patch.object(dl._req, "urlopen", return_value=_Resp({"delivery_codes": []})):
            dl.check_serviceability("638001", "600001")

        assert dl.LAST_COURIER["ok"] is True
        assert dl.LAST_COURIER["detail"] is None
