
def test_health_is_always_ok(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_ready_when_the_database_answers(client):
    resp = client.get("/ready")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_not_ready_when_the_database_is_down(client, monkeypatch):
    def broken(db):
        raise RuntimeError("connection refused")

    monkeypatch.setattr("main._ping_database", broken)
    resp = client.get("/ready")
    assert resp.status_code == 503


def test_not_ready_once_shutdown_has_begun(client):
    from main import app

    app.state.shutting_down = True
    try:
        assert client.get("/ready").status_code == 503
    finally:
        app.state.shutting_down = False
