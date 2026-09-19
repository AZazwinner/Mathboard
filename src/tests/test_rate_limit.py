import os
import time

import pytest
import valkey

from db.core.auth import rate_limit as rl


@pytest.fixture(params=["memory", "valkey"])
def limiter(request, monkeypatch):
    if request.param == "memory":
        monkeypatch.setattr(rl, "get_sync_client", lambda: None)
    elif not os.getenv("TEST_VALKEY_URL"):
        pytest.skip("TEST_VALKEY_URL not set")
    return request.param


def test_not_locked_out_before_the_first_attempt(limiter):
    locked, _ = rl.is_locked_out("key")
    assert locked is False


def test_locks_out_after_max_attempts(limiter):
    for _ in range(rl.MAX_ATTEMPTS - 1):
        rl.record_failure("key")
    locked, _ = rl.is_locked_out("key")
    assert locked is False

    rl.record_failure("key")
    locked, remaining = rl.is_locked_out("key")
    assert locked is True
    assert remaining > 0


def test_success_clears_the_failure_count(limiter):
    for _ in range(rl.MAX_ATTEMPTS - 1):
        rl.record_failure("key")
    rl.record_success("key")


    for _ in range(rl.MAX_ATTEMPTS - 1):
        rl.record_failure("key")
    locked, _ = rl.is_locked_out("key")
    assert locked is False


def test_lockout_expires_after_the_window(limiter, monkeypatch):
    monkeypatch.setattr(rl, "LOCKOUT_SECONDS", 1)

    for _ in range(rl.MAX_ATTEMPTS):
        rl.record_failure("key")
    assert rl.is_locked_out("key")[0] is True

    time.sleep(1.2)
    assert rl.is_locked_out("key")[0] is False


def test_keys_are_independent(limiter):
    for _ in range(rl.MAX_ATTEMPTS):
        rl.record_failure("attacker")
    assert rl.is_locked_out("attacker")[0] is True
    assert rl.is_locked_out("someone-else")[0] is False


def test_lockout_is_shared_across_processes():
    if not os.getenv("TEST_VALKEY_URL"):
        pytest.skip("TEST_VALKEY_URL not set")

    for _ in range(rl.MAX_ATTEMPTS):
        rl.record_failure("shared")

    rl._attempts.clear()
    rl._locked_until.clear()

    assert rl.is_locked_out("shared")[0] is True


def test_falls_back_to_memory_when_valkey_is_unreachable(monkeypatch):
    dead = valkey.Valkey(host="127.0.0.1", port=1, socket_connect_timeout=0.2, socket_timeout=0.2)
    monkeypatch.setattr(rl, "get_sync_client", lambda: dead)

    for _ in range(rl.MAX_ATTEMPTS):
        rl.record_failure("key")

    assert rl.is_locked_out("key")[0] is True
    assert rl.is_locked_out("other")[0] is False
