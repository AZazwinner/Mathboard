import time


def test_health_is_always_ok(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_ready_when_the_database_answers(client):
    resp = client.get("/ready")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ready"}


def test_not_ready_when_the_database_has_stopped_answering(client, monkeypatch):
    import main

    def broken(db):
        raise RuntimeError("connection refused")

    monkeypatch.setattr(main, "_ping_database", broken)
    main.app.state.database_ok_at = time.monotonic() - main.DATABASE_STALE_SECONDS - 1

    assert client.get("/ready").status_code == 503


def test_ready_again_once_the_database_recovers(client, monkeypatch):
    import main

    monkeypatch.setattr(main, "DATABASE_CHECK_SECONDS", 0.1)
    main.app.state.database_ok_at = time.monotonic() - main.DATABASE_STALE_SECONDS - 1
    assert client.get("/ready").status_code == 503

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline and client.get("/ready").status_code != 200:
        time.sleep(0.1)
    assert client.get("/ready").status_code == 200


def test_readiness_does_not_query_the_database_per_request(client, monkeypatch):
    import main

    def fail_if_called(db):
        raise AssertionError("the probe must not hit the database")

    monkeypatch.setattr(main, "_ping_database", fail_if_called)
    main.app.state.database_ok_at = time.monotonic()

    assert client.get("/ready").status_code == 200


def test_not_ready_once_shutdown_has_begun(client):
    from main import app

    app.state.shutting_down = True
    try:
        assert client.get("/ready").status_code == 503
    finally:
        app.state.shutting_down = False
