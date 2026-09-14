from db.core.auth import rate_limit as rl


def test_not_locked_out_before_the_first_attempt():
    locked, _ = rl.is_locked_out("key")
    assert locked is False


def test_locks_out_after_max_attempts():
    for _ in range(rl.MAX_ATTEMPTS - 1):
        rl.record_failure("key")
    locked, _ = rl.is_locked_out("key")
    assert locked is False  # one shy of the limit

    rl.record_failure("key")
    locked, remaining = rl.is_locked_out("key")
    assert locked is True
    assert remaining > 0


def test_success_clears_the_failure_count():
    for _ in range(rl.MAX_ATTEMPTS - 1):
        rl.record_failure("key")
    rl.record_success("key")

    # Same number of failures again shouldn't lock out, since success reset the counter.
    for _ in range(rl.MAX_ATTEMPTS - 1):
        rl.record_failure("key")
    locked, _ = rl.is_locked_out("key")
    assert locked is False


def test_lockout_expires_after_the_window(monkeypatch):
    now = [1_000_000.0]
    monkeypatch.setattr(rl.time, "time", lambda: now[0])

    for _ in range(rl.MAX_ATTEMPTS):
        rl.record_failure("key")
    assert rl.is_locked_out("key")[0] is True

    now[0] += rl.LOCKOUT_SECONDS + 1
    assert rl.is_locked_out("key")[0] is False


def test_keys_are_independent():
    for _ in range(rl.MAX_ATTEMPTS):
        rl.record_failure("attacker")
    assert rl.is_locked_out("attacker")[0] is True
    assert rl.is_locked_out("someone-else")[0] is False
