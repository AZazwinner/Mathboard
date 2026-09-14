def signup(client, username="alice", email="alice@example.com", password="password123"):
    return client.post(
        "/create-user",
        json={"username": username, "email": email, "password": password},
    )


def test_signup_rejects_a_weak_password(client):
    resp = signup(client, password="short")
    assert resp.status_code == 200
    assert resp.json()["code"] == 30
    assert resp.json().get("user") is None


def test_signup_succeeds_and_returns_a_token(client):
    resp = signup(client)
    body = resp.json()
    assert body["code"] == 100
    assert body["user"]["username"] == "alice"
    assert body["token"]


def test_signup_rejects_a_duplicate_username(client):
    signup(client, username="alice", email="a1@example.com")
    resp = signup(client, username="alice", email="a2@example.com")
    assert resp.json()["code"] == 10


def test_signup_rejects_a_duplicate_email(client):
    signup(client, username="alice", email="shared@example.com")
    resp = signup(client, username="bob", email="shared@example.com")
    assert resp.json()["code"] == 20


def test_signup_is_rate_limited_per_ip(client):
    for i in range(5):
        resp = signup(client, username=f"user{i}", email=f"user{i}@example.com")
        assert resp.status_code == 200
    resp = signup(client, username="user5", email="user5@example.com")
    assert resp.status_code == 429


def test_signin_with_correct_credentials_returns_a_token(client):
    signup(client)
    resp = client.post("/signin", json={"username": "alice", "password": "password123"})
    body = resp.json()
    assert body["user"] is not None
    assert body["token"]


def test_signin_with_wrong_password_returns_no_token(client):
    signup(client)
    resp = client.post("/signin", json={"username": "alice", "password": "wrong-password"})
    body = resp.json()
    assert body["user"] is None
    assert body.get("token") is None


def test_signin_locks_out_after_repeated_failures(client):
    signup(client)
    for _ in range(5):
        client.post("/signin", json={"username": "alice", "password": "wrong-password"})
    resp = client.post("/signin", json={"username": "alice", "password": "password123"})
    assert resp.status_code == 429


def test_me_requires_a_valid_token(client):
    signup(client)
    resp = client.get("/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401


def test_me_returns_the_authenticated_user(client):
    token = signup(client).json()["token"]
    resp = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "alice"


def test_changing_password_invalidates_the_old_token(client):
    old_token = signup(client).json()["token"]

    resp = client.post(
        "/user-update-password",
        json={"password": "brand-new-password"},
        headers={"Authorization": f"Bearer {old_token}"},
    )
    assert resp.json()["success"] is True

    # The token used to change the password must no longer work.
    stale = client.get("/me", headers={"Authorization": f"Bearer {old_token}"})
    assert stale.status_code == 401

    # But signing in again with the new password issues a fresh, working token.
    signin_resp = client.post("/signin", json={"username": "alice", "password": "brand-new-password"})
    new_token = signin_resp.json()["token"]
    fresh = client.get("/me", headers={"Authorization": f"Bearer {new_token}"})
    assert fresh.status_code == 200


def test_password_reset_also_invalidates_old_tokens(client):
    old_token = signup(client).json()["token"]

    forgot_resp = client.post("/forgot-password", json={"email": "alice@example.com"})
    reset_link_token = forgot_resp.json()["dev_reset_link"].split("token=")[1]

    reset_resp = client.post(
        "/reset-password",
        json={"token": reset_link_token, "password": "another-new-password"},
    )
    assert reset_resp.json()["success"] is True

    stale = client.get("/me", headers={"Authorization": f"Bearer {old_token}"})
    assert stale.status_code == 401
