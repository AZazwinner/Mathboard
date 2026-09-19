"""Prometheus metrics for the backend.

Everything here is cheap and low-cardinality on purpose: no metric is labelled by document, user or URL
parameter, so the number of series stays fixed however many people are editing.

Metrics are served on their own port (METRICS_PORT), not through the public API, so the gateway never
routes to them. When METRICS_PORT is unset nothing is served and the counters cost next to nothing.
"""

import asyncio
import os
import time

from prometheus_client import Counter, Histogram, start_http_server
from prometheus_client.core import REGISTRY, GaugeMetricFamily
from prometheus_client.registry import Collector

LATENCY_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10)
LOOP_LAG_BUCKETS = (0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5)
LOOP_LAG_INTERVAL_SECONDS = 0.5

document_updates = Counter(
    "mathboard_document_updates_total",
    "Yjs updates applied to a live document, by where they came from: a connected client (local) or another replica or the database (external).",
    ["source"],
)
websocket_connects = Counter(
    "mathboard_websocket_connects_total",
    "WebSocket connections accepted for live editing. A steep rate with a flat connection count means clients are reconnecting.",
)
flush_seconds = Histogram(
    "mathboard_document_flush_seconds",
    "Time to merge one document's state into the database.",
    buckets=LATENCY_BUCKETS,
)
flush_errors = Counter(
    "mathboard_document_flush_errors_total",
    "Document flushes that failed. The state stays in memory and is retried.",
)
bus_errors = Counter(
    "mathboard_bus_errors_total",
    "Failed calls to Valkey, the cross-replica message bus.",
    ["operation"],
)
event_loop_lag = Histogram(
    "mathboard_event_loop_lag_seconds",
    "How late the event loop runs a task scheduled every 0.5 s. Near zero when healthy; it climbs before requests time out.",
    buckets=LOOP_LAG_BUCKETS,
)
http_requests = Counter(
    "mathboard_http_requests_total",
    "HTTP requests handled, by route template (not raw URL) and status.",
    ["method", "route", "status"],
)
http_request_seconds = Histogram(
    "mathboard_http_request_seconds",
    "HTTP request duration, by route template.",
    ["method", "route"],
    buckets=LATENCY_BUCKETS,
)

# Probes and the scrape itself would drown out real traffic in the request metrics.
UNTRACKED_PATHS = {"/health", "/ready"}


class RuntimeCollector(Collector):
    """Gauges read from live objects at scrape time, so there is no counter to keep in step with them."""

    def __init__(self, rooms, engine=None, pool_limit: int = 0):
        self._rooms = rooms
        self._engine = engine
        self._pool_limit = pool_limit

    def collect(self):
        rooms = list(self._rooms().values())
        yield GaugeMetricFamily("mathboard_active_documents", "Documents with at least one connected client on this replica.", value=len(rooms))
        yield GaugeMetricFamily(
            "mathboard_websocket_connections",
            "Open live-editing WebSockets on this replica.",
            value=sum(len(room.sockets) for room in rooms),
        )
        if self._engine is not None and hasattr(self._engine.pool, "checkedout"):
            yield GaugeMetricFamily(
                "mathboard_db_pool_connections_in_use",
                "Database connections currently checked out of this replica's pool.",
                value=self._engine.pool.checkedout(),
            )
            if self._pool_limit:
                yield GaugeMetricFamily(
                    "mathboard_db_pool_connections_limit",
                    "The most database connections this replica may open (pool size plus overflow).",
                    value=self._pool_limit,
                )


class RequestMetricsMiddleware:
    """Plain ASGI middleware. Only HTTP is measured: WebSockets live for hours and would skew a request-duration histogram."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] in UNTRACKED_PATHS:
            await self.app(scope, receive, send)
            return

        status = 500
        started = time.perf_counter()

        async def capture(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, capture)
        finally:
            route = getattr(scope.get("route"), "path", None) or "unmatched"
            method = scope["method"]
            http_requests.labels(method, route, str(status)).inc()
            http_request_seconds.labels(method, route).observe(time.perf_counter() - started)


_collector: RuntimeCollector | None = None


def install_runtime_collector(rooms, engine=None, pool_limit: int = 0) -> None:
    """Registers (or replaces) the collector for live-object gauges. Safe to call more than once."""
    global _collector
    if _collector is not None:
        REGISTRY.unregister(_collector)
    _collector = RuntimeCollector(rooms, engine, pool_limit)
    REGISTRY.register(_collector)


def start_metrics_server():
    """Serves /metrics on METRICS_PORT from a daemon thread. Returns (server, thread), or None when the port isn't configured."""
    port = os.getenv("METRICS_PORT")
    if not port:
        return None
    return start_http_server(int(port))


async def monitor_event_loop() -> None:
    """Measures how far behind schedule the event loop runs. This is the earliest sign of saturation: a busy loop delays this task long before probes or clients notice."""
    while True:
        expected = time.perf_counter() + LOOP_LAG_INTERVAL_SECONDS
        await asyncio.sleep(LOOP_LAG_INTERVAL_SECONDS)
        event_loop_lag.observe(max(0.0, time.perf_counter() - expected))
