import pytest
from fastapi import HTTPException

from db.modules.users.utils.validate import (
    MIN_PASSWORD_LENGTH,
    is_valid_password,
    validate_email,
    validate_password,
)


def test_password_shorter_than_minimum_is_invalid():
    assert is_valid_password("a" * (MIN_PASSWORD_LENGTH - 1)) is False


def test_password_at_minimum_length_is_valid():
    assert is_valid_password("a" * MIN_PASSWORD_LENGTH) is True


def test_validate_password_raises_on_a_weak_password():
    with pytest.raises(HTTPException) as exc_info:
        validate_password("short")
    assert exc_info.value.status_code == 400


def test_validate_password_passes_silently_for_a_strong_password():
    validate_password("a-reasonably-long-password")  # should not raise


def test_validate_email_rejects_malformed_addresses():
    with pytest.raises(HTTPException):
        validate_email("not-an-email")


def test_validate_email_accepts_a_real_looking_address():
    validate_email("someone@example.com")  # should not raise
