import pytest


def signup(client, username, email, password="password123"):
    resp = client.post("/create-user", json={"username": username, "email": email, "password": password})
    body = resp.json()
    return body["user"]["id"], body["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def owner(client):
    return signup(client, "owner", "owner@example.com")


@pytest.fixture()
def other(client):
    return signup(client, "other", "other@example.com")


def create_doc(client, token):
    resp = client.post("/docs/new", json={}, headers=auth(token))
    return resp.json()["doc_id"]


def test_owner_can_read_and_write_their_own_doc(client, owner):
    owner_id, owner_token = owner
    doc_id = create_doc(client, owner_token)

    resp = client.get(f"/docs/{doc_id}", headers=auth(owner_token))
    assert resp.json()["permission"] == "write"

    resp = client.post(
        "/update-doc", json={"doc_id": doc_id, "title": "Renamed"}, headers=auth(owner_token)
    )
    assert resp.json()["success"] is True


def test_stranger_cannot_see_an_unshared_doc(client, owner, other):
    _, owner_token = owner
    _, other_token = other
    doc_id = create_doc(client, owner_token)

    resp = client.get(f"/docs/{doc_id}", headers=auth(other_token))
    assert resp.status_code == 200
    assert resp.json() is None


def test_stranger_cannot_write_an_unshared_doc(client, owner, other):
    _, owner_token = owner
    _, other_token = other
    doc_id = create_doc(client, owner_token)

    resp = client.post(
        "/update-doc", json={"doc_id": doc_id, "title": "Hijacked"}, headers=auth(other_token)
    )
    assert resp.json()["success"] is False


def test_read_shared_user_can_view_but_not_edit(client, owner, other):
    other_id, other_token = other
    _, owner_token = owner
    doc_id = create_doc(client, owner_token)

    share_resp = client.post(
        "/doc-share",
        json={"doc_id": doc_id, "user_id": other_id, "share_type": "read"},
        headers=auth(owner_token),
    )
    assert share_resp.json()["success"] is True

    view_resp = client.get(f"/docs/{doc_id}", headers=auth(other_token))
    assert view_resp.json()["permission"] == "read"

    edit_resp = client.post(
        "/update-doc", json={"doc_id": doc_id, "title": "Nope"}, headers=auth(other_token)
    )
    assert edit_resp.json()["success"] is False


def test_write_shared_user_can_edit(client, owner, other):
    other_id, other_token = other
    _, owner_token = owner
    doc_id = create_doc(client, owner_token)

    client.post(
        "/doc-share",
        json={"doc_id": doc_id, "user_id": other_id, "share_type": "write"},
        headers=auth(owner_token),
    )

    edit_resp = client.post(
        "/update-doc", json={"doc_id": doc_id, "title": "Collab edit"}, headers=auth(other_token)
    )
    assert edit_resp.json()["success"] is True

    check_resp = client.get(f"/docs/{doc_id}", headers=auth(owner_token))
    assert check_resp.json()["title"] == "Collab edit"


def test_only_the_owner_or_a_write_collaborator_can_share_the_doc(client, owner, other):
    other_id, other_token = other
    _, owner_token = owner
    doc_id = create_doc(client, owner_token)

    # `other` has no access at all yet, so they can't grant themselves a share either.
    resp = client.post(
        "/doc-share",
        json={"doc_id": doc_id, "user_id": other_id, "share_type": "write"},
        headers=auth(other_token),
    )
    assert resp.json()["success"] is False
