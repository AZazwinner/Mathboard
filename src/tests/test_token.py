from datetime import datetime, timedelta

from jose import jwt

from db.core.auth.utils.token import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    verify_access_token,
)


def test_round_trip_returns_the_same_user_id_and_version():
    token = create_access_token(user_id=42, token_version=3)
    result = verify_access_token(token)
    assert result == (42, 3)


def test_default_token_version_is_zero():
    token = create_access_token(user_id=1)
    result = verify_access_token(token)
    assert result == (1, 0)


def test_garbage_token_is_rejected():
    assert verify_access_token("not-a-real-token") is None


def test_token_signed_with_a_different_key_is_rejected():
    forged = jwt.encode(
        {"sub": "1", "ver": 0, "exp": datetime.utcnow() + timedelta(minutes=5)},
        "a-different-secret",
        algorithm=ALGORITHM,
    )
    assert verify_access_token(forged) is None


def test_expired_token_is_rejected():
    expired = jwt.encode(
        {"sub": "1", "ver": 0, "exp": datetime.utcnow() - timedelta(minutes=1)},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    assert verify_access_token(expired) is None


def test_token_missing_the_version_claim_defaults_to_zero():

    legacy = jwt.encode(
        {"sub": "1", "exp": datetime.utcnow() + timedelta(minutes=5)},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    assert verify_access_token(legacy) == (1, 0)
