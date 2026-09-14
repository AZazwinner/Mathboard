import time
from collections import defaultdict


MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60
LOCKOUT_SECONDS = 15 * 60

_attempts: dict[str, list[float]] = defaultdict(list)
_locked_until: dict[str, float] = {}


def _prune(key: str, now: float) -> None:
    _attempts[key] = [t for t in _attempts[key] if now - t < WINDOW_SECONDS]


def is_locked_out(key: str) -> tuple[bool, float]:
    """Returns (locked, seconds_remaining)."""
    now = time.time()
    until = _locked_until.get(key)
    if until is None:
        return False, 0.0
    if now >= until:
        del _locked_until[key]
        return False, 0.0
    return True, until - now


def record_failure(key: str) -> None:
    now = time.time()
    _prune(key, now)
    _attempts[key].append(now)
    if len(_attempts[key]) >= MAX_ATTEMPTS:
        _locked_until[key] = now + LOCKOUT_SECONDS
        _attempts[key] = []


def record_success(key: str) -> None:
    _attempts.pop(key, None)
    _locked_until.pop(key, None)
