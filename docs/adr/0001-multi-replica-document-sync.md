# 1. Syncing live documents across backend replicas

## Problem

Each backend process kept the canonical Y.Doc for every open document in memory and saved it by
overwriting the stored state. That only works with exactly one process. With two replicas:

- users on the same document could land on different replicas and never see each other's edits;
- whichever replica saved last replaced the other's edits in Postgres, silently losing data;
- two replicas opening a never-opened document at the same moment each built their own history from
  the same blocks, and merging those two histories duplicates every block;
- the login rate limiter lived in process memory, so its lockout was N times weaker with N replicas.

## Decision

1. **Edits travel through a Valkey stream per document.** A local update is applied, relayed to that
   replica's sockets, and appended to `mb:ydoc:<id>`. Every replica with the document open reads the
   stream and applies updates from other replicas. Yjs updates commute and are idempotent, so
   order, duplicates and replays cannot corrupt a copy. Each room tags its entries with a random id
   and skips its own, so replicas never echo each other.
2. **Cursors travel over pub/sub** (`mb:aw:<id>`), because they are ephemeral and should not be
   replayed. A room that starts announces itself and existing rooms re-publish their local cursors, so
   it doesn't have to wait for the next heartbeat. When a socket leaves, the removal is published too.
3. **Saving is a merge, not an overwrite.** A flush takes a Postgres advisory lock for the document,
   merges the database state with the replica's state in a throwaway Y.Doc, and writes the merged
   state and the read-model blocks in one transaction. It then applies whatever other replicas saved
   back into the live room.
4. **The stream position is saved with the state** (`document_ydocs.stream_id`). A replica that opens
   a document loads the snapshot and replays the stream from that position, so it recovers edits that
   were published but not yet saved. The stream is trimmed only behind the saved position and never
   newer than five minutes, and it expires after an hour of silence.
5. **Postgres is the fallback path.** Every live room also polls the database every 10 seconds and
   applies changes it doesn't have. If Valkey is down, publishing and reading fail with backoff, editing
   is unaffected, and replicas converge through saves and this poll.
6. **Creating a document's Y.Doc is done under the same advisory lock**, so two replicas can't create
   conflicting histories.
7. **Rate limits live in Valkey** (sorted sets and TTL keys, hashed identifiers), falling back to
   per-process counters if Valkey can't be reached, so a Valkey outage never blocks logins.
8. **Restoring a version** is refused while any replica has the document open (presence keys with a
   short TTL, failing closed if Valkey is unreachable) and clears the stream.

The block table's primary key became `(doc_id, id)`. Before, one colliding block id in two documents
made every save of the second document fail.

## Alternatives considered

- **Route every user of a document to the same replica.** Envoy Gateway's consistent hashing keys
  on source IP, a header or a cookie ([docs](https://gateway.envoyproxy.io/docs/tasks/traffic/load-balancing/)).
  The document id is only in the WebSocket path, and browsers can't set custom headers on WebSockets, so
  there is nothing document-specific to hash on. It would also make one replica a single point of
  failure for its documents.
- **y-redis / y/hub.** It solves this problem, but it is beta, has no Helm chart, and is dual-licensed
  AGPL-3.0 or proprietary ([repo](https://github.com/yjs/y-redis)), which is a poor fit for this project.
- **Redis instead of Valkey.** Redis 8 is licensed AGPLv3, SSPLv1 or RSALv2; Valkey is BSD-3-Clause under
  the Linux Foundation and wire compatible, using its official Python client (valkey-py, MIT).
- **Pub/sub for document updates.** Pub/sub is fire-and-forget: a replica that starts late or blips
  would miss updates. A stream can be replayed from a position.
- **A single multiplexed reader per replica.** Cheaper in connections than one blocking read per live
  document, but it has to be restarted whenever the set of documents changes. Not needed at this scale.

## Consequences and known limits

- Valkey is not persisted. Losing it drops only in-flight coordination state; measured with Valkey
  down for 10 seconds mid-session, no client disconnected and all edits converged about 4 seconds after the
  last one.
- If a replica crashes, cursors it published stay visible on other replicas until the document's last
  socket on them leaves. (A clean disconnect removes them.)
- The database poll costs one indexed read per live document every 10 seconds per replica.
- A restore has a narrow race: someone could open the document between the liveness check and the write.
- The WebSocket authenticates with a token in the URL, which uvicorn's access log records. That
  predates this change and is worth fixing separately.

## Evidence

`src/tests/test_multi_replica.py` runs two or three replicas in one process against a real Postgres and
Valkey. Removing the merge, or removing the creation lock, makes the corresponding test fail. On a 3-replica
kind cluster, 12 Yjs clients made 540 edits to one document while the busiest pod was deleted gracefully,
then force-killed, then Valkey was taken down; every run ended with identical documents on all clients and
all 541 blocks in Postgres.
