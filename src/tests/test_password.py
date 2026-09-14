from db.core.auth.utils.password import hash_password, verify_password


def test_hash_is_not_the_plaintext():
    assert hash_password("correct horse battery staple") != "correct horse battery staple"


def test_verify_accepts_the_matching_password():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed) is True


def test_verify_rejects_a_wrong_password():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("wrong password", hashed) is False


def test_same_password_hashes_differently_each_time():


    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")
    assert first != second
    assert verify_password("correct horse battery staple", first)
    assert verify_password("correct horse battery staple", second)
