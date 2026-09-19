"""Turns the autoscale sampler's CSV into a short table of when the replica count changed."""

import argparse
import csv
import json
from pathlib import Path


def load_rows(path: Path) -> list[dict]:
    rows = []
    for row in csv.DictReader(path.open()):
        if row["replicas"].isdigit():
            rows.append({
                "t": int(row["t"]),
                "replicas": int(row["replicas"]),
                "ready": int(row["ready"] or 0),
                "per_replica": row["connections_per_replica"],
            })
    return rows


def changes(rows: list[dict]) -> list[dict]:
    out, last = [], None
    for row in rows:
        if row["replicas"] != last:
            out.append(row)
            last = row["replicas"]
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--k6", required=True)
    parser.add_argument("--vus", type=int, required=True)
    parser.add_argument("--ramp", type=int, required=True)
    parser.add_argument("--hold", type=int, required=True)
    parser.add_argument("--load-ended", type=int, required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--tag", default="latest")
    args = parser.parse_args()

    rows = load_rows(Path(args.csv))
    steps = changes(rows)
    peak = max(r["replicas"] for r in rows)
    first_up = next((r["t"] for r in rows if r["replicas"] > rows[0]["replicas"]), None)

    k6 = json.loads(Path(args.k6).read_text())
    unexpected = k6["metrics"].get("ws_unexpected_closes", {}).get("count", 0)
    lat = k6["metrics"].get("fanout_latency_ms", {})

    lines = [
        f"# Autoscaling run: {args.vus} users",
        "",
        f"Users ramped up over {args.ramp}s and held for {args.hold}s (seconds are counted from the start of sampling).",
        f"Load ended at t={args.load_ended}s. Started at {rows[0]['replicas']} replicas, peaked at {peak}.",
    ]
    if first_up is not None:
        lines.append(f"First scale-up at t={first_up}s.")
    lines += [
        f"Unexpected socket closes during the run: {int(unexpected)}.",
        f"Fan-out latency p95: {lat.get('p(95)', float('nan')):.0f} ms.",
        "",
        "| t (s) | replicas wanted | ready | connections per replica (autoscaler's view) |",
        "|---:|---:|---:|---:|",
    ]
    lines += [f"| {r['t']} | {r['replicas']} | {r['ready']} | {r['per_replica'] or 'n/a'} |" for r in steps]

    out = Path(args.out)
    (out / f"autoscale-{args.tag}.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
