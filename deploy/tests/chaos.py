"""Chaos test for the multi-replica document sync.

Simulated browsers (each with its own full Yjs document, like the real editor) connect to one shared
document through the Gateway and make edits while a failure is injected into the cluster. A scenario
passes only if, once the dust settles:

  * the clients were really spread over more than one backend replica (otherwise it proved nothing),
  * every client holds every edit that was made,
  * all clients hold the identical document, and
  * Postgres holds every block.

    python deploy/tests/chaos.py                      # every scenario
    python deploy/tests/chaos.py -s hard graceful     # just these
    python deploy/tests/chaos.py --json results.json

Needs kubectl pointed at the kind cluster (bash deploy/kind/up.sh).
"""

import argparse
import asyncio
import json
import random
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

import pycrdt
import websockets

BLOCKS_KEY = "blocks"
BACKEND_SELECTOR = "app.kubernetes.io/component=backend"
VALKEY_SELECTOR = "app.kubernetes.io/component=valkey"

_real_getaddrinfo = socket.getaddrinfo


def _resolve_localhost_names(host, *args, **kwargs):
    """*.localhost is loopback by RFC 6761, but Windows' resolver doesn't know that."""
    if isinstance(host, str) and host.endswith(".localhost"):
        host = "127.0.0.1"
    return _real_getaddrinfo(host, *args, **kwargs)


socket.getaddrinfo = _resolve_localhost_names


class Kube:
    def __init__(self, context: str | None, db_pod: str):
        self.base = ["kubectl"] + (["--context", context] if context else [])
        self.db_pod = db_pod

    def run(self, *args: str, check: bool = False) -> str:
        result = subprocess.run([*self.base, *args], capture_output=True, text=True)
        if check and result.returncode != 0:
            raise RuntimeError(f"kubectl {' '.join(args)} failed: {result.stderr.strip()}")
        return result.stdout

    def ready_pods(self, selector: str) -> list[str]:
        out = self.run("get", "pods", "-l", selector, "-o", "json")
        ready = []
        for pod in json.loads(out or '{"items": []}')["items"]:
            if pod["metadata"].get("deletionTimestamp"):
                continue
            statuses = pod["status"].get("containerStatuses", [])
            if statuses and all(s.get("ready") for s in statuses):
                ready.append(pod["metadata"]["name"])
        return ready

    def backend_pods(self) -> list[str]:
        return self.run("get", "pods", "-l", BACKEND_SELECTOR, "-o", "name").split()

    def sockets_per_pod(self, doc_id: int) -> dict[str, int]:
        counts = {}
        for pod in self.backend_pods():
            log = self.run("logs", pod, "--since=120s")
            counts[pod.split("/")[1]] = log.count(f"/ws/docs/{doc_id}?")
        return counts

    def wait_healthy(self, timeout: int = 180) -> None:
        for deployment in ("mathboard-backend", "mathboard-valkey"):
            self.run("rollout", "status", f"deploy/{deployment}", f"--timeout={timeout}s", check=True)
        deadline = time.time() + timeout
        while time.time() < deadline:
            if len(self.ready_pods(BACKEND_SELECTOR)) >= 2 and self.ready_pods(VALKEY_SELECTOR):
                return
            time.sleep(1)
        raise RuntimeError("cluster did not become healthy again")

    def blocks_in_database(self, doc_id: int) -> int:
        out = self.run(
            "exec", self.db_pod, "-c", "postgres", "--", "psql", "-U", "postgres", "-d", "mathboard",
            "-t", "-A", "-c", f"select count(*) from document_blocks where doc_id={doc_id}",
        )
        return int(out.strip() or 0)


class Api:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.ws_url = self.base_url.replace("http", "ws", 1)

    def post(self, path: str, body: dict, token: str | None = None) -> dict:
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(self.base_url + path, json.dumps(body).encode(), headers)
        return json.load(urllib.request.urlopen(request, timeout=15))

    def signup(self) -> str:
        stamp = f"{int(time.time())}{uuid.uuid4().hex[:4]}"
        return self.post("/create-user", {
            "username": f"chaos{stamp}", "email": f"chaos{stamp}@example.com", "password": "password123",
        })["token"]

    def new_doc(self, token: str) -> int:
        return self.post("/docs/new", {}, token)["doc_id"]


class Client:
    """A simulated browser: keeps a full local document and re-syncs it on every (re)connect."""

    def __init__(self, name: str, url: str):
        self.name, self.url = name, url
        self.doc = pycrdt.Doc()
        self.blocks = self.doc.get(BLOCKS_KEY, type=pycrdt.Array)
        self.ws = None
        self.remote = False
        self.reconnects = -1
        self.stop = False
        self.doc.observe(self._on_change)

    def _on_change(self, event) -> None:
        if not self.remote and self.ws is not None:
            asyncio.get_running_loop().create_task(self._send(pycrdt.create_update_message(event.update)))

    async def _send(self, message: bytes) -> None:
        try:
            await self.ws.send(message)
        except Exception:
            pass

    def add_block(self, text: str) -> str:
        block_id = str(uuid.uuid4())
        self.blocks.append(pycrdt.Map({"id": block_id, "type": "paragraph", "text": pycrdt.Text(text)}))
        return block_id

    def ids(self) -> list[str]:
        return [b["id"] for b in self.blocks.to_py()]

    async def run(self) -> None:
        while not self.stop:
            self.reconnects += 1
            try:
                async with websockets.connect(self.url, ping_interval=None) as ws:
                    self.ws = ws
                    await ws.send(pycrdt.create_sync_message(self.doc))
                    async for raw in ws:
                        if raw[0] != pycrdt.YMessageType.SYNC:
                            continue
                        self.remote = True
                        try:
                            reply = pycrdt.handle_sync_message(raw[1:], self.doc)
                        finally:
                            self.remote = False
                        if reply is not None:
                            await ws.send(reply)
            except Exception:
                pass
            self.ws = None
            await asyncio.sleep(0.4 + random.random() * 0.4)


async def edit(client: Client, count: int, made: list[str]) -> None:
    for i in range(count):
        await asyncio.sleep(0.1 + random.random() * 0.4)
        made.append(client.add_block(f"{client.name} edit {i}"))


def victim_of(counts: dict[str, int]) -> str:
    return max(counts, key=counts.get)


async def inject_none(kube: Kube, doc_id: int, counts: dict[str, int]) -> str:
    return "no failure injected"


async def inject_graceful(kube: Kube, doc_id: int, counts: dict[str, int]) -> str:
    victim = victim_of(counts)
    kube.run("delete", "pod", victim, "--wait=false")
    return f"deleted {victim} gracefully, like a rolling deploy"


async def inject_hard(kube: Kube, doc_id: int, counts: dict[str, int]) -> str:
    victim = victim_of(counts)
    kube.run("delete", "pod", victim, "--grace-period=0", "--force")
    return f"force-killed {victim} with no shutdown, like a crash"


async def inject_valkey_down(kube: Kube, doc_id: int, counts: dict[str, int]) -> str:
    kube.run("scale", "deploy/mathboard-valkey", "--replicas=0")
    await asyncio.sleep(10)
    kube.run("scale", "deploy/mathboard-valkey", "--replicas=1")
    return "Valkey scaled to zero for 10s"


async def inject_rolling_restart(kube: Kube, doc_id: int, counts: dict[str, int]) -> str:
    kube.run("rollout", "restart", "deploy/mathboard-backend")
    return "rolling restart of every backend pod"


SCENARIOS = {
    "none": (inject_none, 45),
    "graceful": (inject_graceful, 45),
    "hard": (inject_hard, 45),
    "valkey-down": (inject_valkey_down, 45),
    "rolling-restart": (inject_rolling_restart, 200),
}


async def run_scenario(name: str, api: Api, kube: Kube, token: str, clients_n: int, edits: int | None) -> dict:
    inject, default_edits = SCENARIOS[name]
    edits_each = edits or default_edits
    kube.wait_healthy()

    doc_id = api.new_doc(token)
    url = f"{api.ws_url}/ws/docs/{doc_id}?token={token}"
    clients = [Client(f"c{i}", url) for i in range(clients_n)]
    tasks = [asyncio.create_task(c.run()) for c in clients]
    await asyncio.sleep(1.5)

    made: list[str] = []
    note = {"text": ""}

    async def failure() -> None:
        await asyncio.sleep(1.8)
        counts = kube.sockets_per_pod(doc_id)
        note["counts"] = counts
        note["text"] = await inject(kube, doc_id, counts)

    started = time.time()
    await asyncio.gather(failure(), *[edit(c, edits_each, made) for c in clients])
    edits_finished = time.time()

    expected = set(made)
    deadline = time.time() + 120
    while time.time() < deadline and not all(expected <= set(c.ids()) for c in clients):
        await asyncio.sleep(0.25)
    converged_after = time.time() - edits_finished

    missing = {c.name: len(expected - set(c.ids())) for c in clients if expected - set(c.ids())}
    orders = {tuple(c.ids()) for c in clients}
    total_blocks = len(clients[0].ids())
    reconnects = [c.reconnects for c in clients]

    await asyncio.sleep(1)
    for c in clients:
        c.stop = True
        if c.ws is not None:
            await c.ws.close()
    await asyncio.gather(*tasks, return_exceptions=True)

    in_db = 0
    deadline = time.time() + 20
    while time.time() < deadline:
        in_db = kube.blocks_in_database(doc_id)
        if in_db == total_blocks:
            break
        await asyncio.sleep(2)

    counts = note.get("counts", {})
    spread = sum(1 for n in counts.values() if n > 0)
    checks = {
        "spread over 2+ replicas": spread >= 2,
        "every client has every edit": not missing,
        "all clients identical": len(orders) == 1,
        "database has every block": in_db == total_blocks,
    }
    return {
        "scenario": name,
        "injected": note["text"],
        "clients": clients_n,
        "edits": len(expected),
        "sockets_per_replica": counts,
        "seconds_editing": round(edits_finished - started, 1),
        "seconds_to_converge_after_last_edit": round(converged_after, 1),
        "reconnects_per_client": reconnects,
        "blocks_in_clients": total_blocks,
        "blocks_in_database": in_db,
        "checks": checks,
        "passed": all(checks.values()),
    }


def print_result(result: dict) -> None:
    mark = "PASS" if result["passed"] else "FAIL"
    print(f"\n[{mark}] {result['scenario']}: {result['injected']}")
    print(f"       {result['edits']} edits by {result['clients']} clients over {result['seconds_editing']}s, "
          f"sockets per replica {list(result['sockets_per_replica'].values())}")
    print(f"       converged {result['seconds_to_converge_after_last_edit']}s after the last edit, "
          f"reconnects {result['reconnects_per_client']}, blocks in db {result['blocks_in_database']}/{result['blocks_in_clients']}")
    for check, ok in result["checks"].items():
        print(f"         {'ok  ' if ok else 'FAIL'} {check}")


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-s", "--scenario", nargs="+", choices=[*SCENARIOS, "all"], default=["all"])
    parser.add_argument("--clients", type=int, default=12)
    parser.add_argument("--edits", type=int, help="edits per client (default depends on the scenario)")
    parser.add_argument("--api", default="http://api.localhost:8080")
    parser.add_argument("--context", default=None, help="kubectl context (default: current)")
    parser.add_argument("--db-pod", default="mathboard-db-1")
    parser.add_argument("--json", dest="json_path", help="write the results here")
    args = parser.parse_args()

    names = list(SCENARIOS) if "all" in args.scenario else args.scenario
    kube, api = Kube(args.context, args.db_pod), Api(args.api)

    try:
        kube.wait_healthy(timeout=30)
    except Exception as e:
        print(f"cluster is not ready: {e}", file=sys.stderr)
        return 2
    if len(kube.ready_pods(BACKEND_SELECTOR)) < 2:
        print("need at least 2 ready backend replicas", file=sys.stderr)
        return 2

    try:
        token = api.signup()
    except urllib.error.HTTPError as e:
        print(f"could not sign up a test user ({e.code}); if it is 429, clear the throttle: "
              "kubectl exec deploy/mathboard-valkey -- sh -c \"valkey-cli --scan --pattern 'mb:rl:*' | xargs -r valkey-cli del\"",
              file=sys.stderr)
        return 2

    results = []
    for name in names:
        print(f"\n=== {name} ===", flush=True)
        result = await run_scenario(name, api, kube, token, args.clients, args.edits)
        print_result(result)
        results.append(result)

    kube.wait_healthy()
    passed = sum(r["passed"] for r in results)
    print(f"\n{passed}/{len(results)} scenarios passed")
    if args.json_path:
        with open(args.json_path, "w") as f:
            json.dump({"finished_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "results": results}, f, indent=2)
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
