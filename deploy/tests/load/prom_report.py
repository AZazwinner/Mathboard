"""Explains a load run from Prometheus: for each stretch where users were connected, what each backend pod was doing.

The k6 summary says how slow the run was; this says why. For every window with load it prints, per pod, the peak
connections, the event-loop lag (how far behind schedule the process ran), document save time, and CPU, plus
Postgres and Valkey CPU. A pod near one core with a climbing event-loop lag is saturated; uneven connections
mean load is not spreading; one pod far worse than the rest points at where it runs.

Needs the monitoring stack (bash deploy/kind/observability.sh up) and a port-forward:

    kubectl -n monitoring port-forward svc/prometheus-server 9090:80
    python deploy/tests/load/prom_report.py --last-minutes 15
"""

import argparse
import json
import time
import urllib.parse
import urllib.request

LOAD_THRESHOLD_CONNECTIONS = 100


def query_range(base: str, expr: str, start: float, end: float, step: int = 15) -> list[dict]:
    params = urllib.parse.urlencode({"query": expr, "start": start, "end": end, "step": step})
    with urllib.request.urlopen(f"{base}/api/v1/query_range?{params}", timeout=30) as response:
        return json.load(response)["data"]["result"]


def load_windows(base: str, start: float, end: float) -> list[tuple[float, float]]:
    series = query_range(base, "sum(mathboard_websocket_connections)", start, end)
    windows, current = [], None
    for timestamp, value in ((float(t), float(v)) for t, v in (series[0]["values"] if series else [])):
        if value > LOAD_THRESHOLD_CONNECTIONS:
            current = [timestamp, timestamp] if current is None else [current[0], timestamp]
        elif current is not None:
            windows.append((current[0], current[1]))
            current = None
    if current is not None:
        windows.append((current[0], current[1]))
    return windows


def peak_by_pod(base: str, expr: str, start: float, end: float) -> dict[str, float]:
    peaks = {}
    for series in query_range(base, expr, start, end):
        values = [float(v) for _, v in series["values"] if v != "NaN"]
        if values:
            peaks[series["metric"].get("pod", "all")[-5:]] = max(values)
    return dict(sorted(peaks.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--last-minutes", type=int, default=15)
    parser.add_argument("--prometheus", default="http://localhost:9090")
    args = parser.parse_args()

    end = time.time()
    start = end - args.last_minutes * 60
    windows = load_windows(args.prometheus, start, end)
    if not windows:
        print(f"No stretch with more than {LOAD_THRESHOLD_CONNECTIONS} connections in the last {args.last_minutes} minutes.")
        return

    ms = lambda seconds: {pod: round(v * 1000) for pod, v in seconds.items()}  # noqa: E731
    for number, (first, last) in enumerate(windows, 1):
        print(f"\nWindow {number}: {int(last - first)} s of load")
        peak = lambda expr: peak_by_pod(args.prometheus, expr, first, last)  # noqa: E731
        print("  peak connections per pod:      ", peak("mathboard_websocket_connections"))
        print("  event-loop lag p99 (ms):       ", ms(peak(
            "histogram_quantile(0.99, sum by (le, pod) (rate(mathboard_event_loop_lag_seconds_bucket[30s])))")))
        print("  document save p95 (ms):        ", ms(peak(
            "histogram_quantile(0.95, sum by (le, pod) (rate(mathboard_document_flush_seconds_bucket[30s])))")))
        print("  edits applied per second:      ", {pod: round(v) for pod, v in peak(
            "sum by (pod) (rate(mathboard_document_updates_total[30s]))").items()},
              "of which arriving from other replicas:", {pod: round(v) for pod, v in peak(
            'sum by (pod) (rate(mathboard_document_updates_total{source="external"}[30s]))').items()})
        print("  backend CPU (cores):           ", {pod: round(v, 2) for pod, v in peak(
            'sum by (pod) (rate(container_cpu_usage_seconds_total{pod=~"mathboard-backend-.*", container="backend"}[30s]))').items()})
        print("  Postgres / Valkey CPU (cores): ",
              {pod: round(v, 2) for pod, v in peak('sum(rate(container_cpu_usage_seconds_total{pod=~"mathboard-db-.*", container="postgres"}[30s]))').items()},
              {pod: round(v, 2) for pod, v in peak('sum(rate(container_cpu_usage_seconds_total{pod=~"mathboard-valkey-.*"}[30s]))').items()})


if __name__ == "__main__":
    main()
