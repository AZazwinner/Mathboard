"""Turns k6's exported summaries (and the CPU samples taken alongside) into a results table.

    python summarize.py --work .work --out results --vus 300 --group 10 --edit-every-ms 1000 --hold 60 --replicas "1 3 5"
"""

import argparse
import json
import statistics
import time
from pathlib import Path


def metric(summary: dict, name: str) -> dict:
    return summary["metrics"].get(name) or {}


def cores_busy(cpu_log: Path) -> tuple[float | None, float | None]:
    """Mean CPU, in cores, of the whole kind cluster and of the k6 container. The first and last samples are ramp-up and ramp-down."""
    if not cpu_log.exists():
        return None, None
    cluster_samples, k6_samples, cluster, k6 = [], [], 0.0, 0.0
    for line in cpu_log.read_text().splitlines():
        if line.strip() == "---":
            cluster_samples.append(cluster)
            k6_samples.append(k6)
            cluster, k6 = 0.0, 0.0
        elif line.strip():
            name, cpu = line.split()
            value = float(cpu.rstrip("%"))
            if name == "k6-load":
                k6 += value
            else:
                cluster += value

    def steady_mean(samples: list[float]) -> float | None:
        steady = samples[2:-2] if len(samples) > 6 else samples
        return round(statistics.mean(steady) / 100, 1) if steady else None

    return steady_mean(cluster_samples), steady_mean(k6_samples)


def summarize_run(replicas: int, work: Path) -> dict:
    summary = json.loads((work / f"summary-r{replicas}.json").read_text())
    latency, connect = metric(summary, "fanout_latency_ms"), metric(summary, "ws_connect_ok")
    sent, received = metric(summary, "edits_sent"), metric(summary, "edits_received")
    cluster_cores, k6_cores = cores_busy(work / f"cpu-r{replicas}.log")
    return {
        "replicas": replicas,
        "connections_ok": f"{connect.get('passes', 0)}/{connect.get('passes', 0) + connect.get('fails', 0)}",
        "edits_sent": sent.get("count", 0),
        "catchup_edits_received": metric(summary, "catchup_edits_received").get("count", 0),
        "edits_per_second": round(sent.get("rate", 0)),
        "deliveries_per_second": round(received.get("rate", 0)),
        "fanout_ms": {k: round(latency.get(k, 0), 1) for k in ("avg", "med", "p(90)", "p(95)", "p(99)", "max")},
        "unexpected_closes": metric(summary, "ws_unexpected_closes").get("count", 0),
        "cluster_cores_busy": cluster_cores,
        "k6_cores_busy": k6_cores,
        "backend_restarts": int((work / f"restarts-r{replicas}.txt").read_text().strip() or 0)
        if (work / f"restarts-r{replicas}.txt").exists() else None,
    }


def markdown_table(runs: list[dict]) -> str:
    rows = [
        "| Backend replicas | Connections ok | Edits/s in | Deliveries/s out | Fan-out p50 | p95 | p99 | max | Dropped sockets | Pod restarts | Cluster CPU (cores) | k6 CPU (cores) |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in runs:
        f = r["fanout_ms"]
        rows.append(
            f"| {r['replicas']} | {r['connections_ok']} | {r['edits_per_second']} | {r['deliveries_per_second']} "
            f"| {f['med']:g} ms | {f['p(95)']:g} ms | {f['p(99)']:g} ms | {f['max']:g} ms "
            f"| {r['unexpected_closes']} | {r['backend_restarts']} | {r['cluster_cores_busy']} | {r['k6_cores_busy']} |"
        )
    return "\n".join(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--vus", type=int, required=True)
    parser.add_argument("--group", type=int, required=True)
    parser.add_argument("--edit-every-ms", type=int, required=True)
    parser.add_argument("--hold", type=int, required=True)
    parser.add_argument("--replicas", required=True)
    parser.add_argument("--tag", default="latest")
    args = parser.parse_args()

    work, out = Path(args.work), Path(args.out)
    runs = [summarize_run(int(r), work) for r in args.replicas.split()]

    table = markdown_table(runs)
    header = (
        f"{args.vus} simulated users in groups of {args.group} sharing a document, each making one edit every "
        f"{args.edit_every_ms} ms, held for {args.hold} s. Every edit is delivered to the other {args.group - 1} "
        f"users in its group. k6 and the whole cluster share one machine, so treat absolute numbers as indicative."
    )
    report = f"{header}\n\n{table}\n"

    out.mkdir(exist_ok=True)
    (out / f"load-{args.tag}.md").write_text(report)
    (out / f"load-{args.tag}.json").write_text(json.dumps({
        "finished_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "users": args.vus, "group_size": args.group, "edit_every_ms": args.edit_every_ms,
        "hold_seconds": args.hold, "runs": runs,
    }, indent=2))
    print(report)


if __name__ == "__main__":
    main()
