import asyncio
import time
import urllib.request

import pycrdt
import pytest
from prometheus_client import REGISTRY

import metrics
from tests.test_docs_permissions import auth, create_doc, signup
from tests.test_liveshare_ws import connect, new_block_update


def sample(name, **labels):
    return REGISTRY.get_sample_value(name, labels or None) or 0.0


def wait_for(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.05)
    return predicate()


@pytest.fixture()
def owner(client):
    return signup(client, "owner", "owner@example.com")


def test_connections_and_documents_track_open_sockets(client, owner):
    _, token = owner
    doc_id = create_doc(client, token)
    assert sample("mathboard_websocket_connections") == 0

    with connect(client, doc_id, token) as ws:
        ws.receive_bytes()
        assert sample("mathboard_websocket_connections") == 1
        assert sample("mathboard_active_documents") == 1

    assert wait_for(lambda: sample("mathboard_websocket_connections") == 0)
    assert sample("mathboard_active_documents") == 0


def test_client_edits_are_counted_as_local_updates(client, owner):
    _, token = owner
    doc_id = create_doc(client, token)
    before = sample("mathboard_document_updates_total", source="local")
    connects_before = sample("mathboard_websocket_connects_total")

    with connect(client, doc_id, token) as ws:
        ws.receive_bytes()
        ws.send_bytes(new_block_update("m-1", "hello"))
        assert wait_for(lambda: sample("mathboard_document_updates_total", source="local") == before + 1)

    assert sample("mathboard_websocket_connects_total") == connects_before + 1


def test_closing_a_document_records_a_flush(client, owner):
    _, token = owner
    doc_id = create_doc(client, token)
    before = sample("mathboard_document_flush_seconds_count")

    with connect(client, doc_id, token) as ws:
        ws.receive_bytes()
        ws.send_bytes(new_block_update("m-1", "hello"))

    assert wait_for(lambda: sample("mathboard_document_flush_seconds_count") > before)


def test_a_failed_flush_is_counted_and_raised(monkeypatch):
    from db.modules.liveshare import ydoc_room

    def broken(*args):
        raise RuntimeError("database gone")

    monkeypatch.setattr(ydoc_room, "write_snapshot", broken)
    room = ydoc_room.YRoom(1, pycrdt.Doc())
    before = sample("mathboard_document_flush_errors_total")

    with pytest.raises(RuntimeError):
        asyncio.run(room.flush())

    assert sample("mathboard_document_flush_errors_total") == before + 1


def test_http_requests_are_labelled_by_route_template_not_url(client, owner):
    _, token = owner
    doc_id = create_doc(client, token)
    labels = dict(method="GET", route="/docs/{doc_id}", status="200")
    before = sample("mathboard_http_requests_total", **labels)

    client.get(f"/docs/{doc_id}", headers=auth(token))

    assert sample("mathboard_http_requests_total", **labels) == before + 1
    assert sample("mathboard_http_requests_total", method="GET", route=f"/docs/{doc_id}", status="200") == 0


def test_unknown_paths_share_one_label_instead_of_one_series_each(client):
    labels = dict(method="GET", route="unmatched", status="404")
    before = sample("mathboard_http_requests_total", **labels)

    client.get("/no-such-path-1")
    client.get("/no-such-path-2")

    assert sample("mathboard_http_requests_total", **labels) == before + 2


def test_probes_are_not_counted(client):
    before = sum(s.value for m in REGISTRY.collect() if m.name == "mathboard_http_requests" for s in m.samples)

    client.get("/health")
    client.get("/ready")

    after = sum(s.value for m in REGISTRY.collect() if m.name == "mathboard_http_requests" for s in m.samples)
    assert after == before


def test_the_event_loop_monitor_records_lag():
    async def run():
        task = asyncio.create_task(metrics.monitor_event_loop())
        await asyncio.sleep(metrics.LOOP_LAG_INTERVAL_SECONDS * 2.5)
        task.cancel()

    before = sample("mathboard_event_loop_lag_seconds_count")
    asyncio.run(run())
    assert sample("mathboard_event_loop_lag_seconds_count") >= before + 2


def test_metrics_server_is_off_unless_a_port_is_configured(monkeypatch):
    monkeypatch.delenv("METRICS_PORT", raising=False)
    assert metrics.start_metrics_server() is None


def test_metrics_server_serves_the_registry(client, monkeypatch):
    import socket

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    monkeypatch.setenv("METRICS_PORT", str(port))

    server, thread = metrics.start_metrics_server()
    try:
        body = urllib.request.urlopen(f"http://127.0.0.1:{port}/metrics", timeout=5).read().decode()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

    assert "mathboard_websocket_connections" in body
    assert "mathboard_active_documents" in body
    assert "process_resident_memory_bytes" in body or "python_gc_objects_collected_total" in body
