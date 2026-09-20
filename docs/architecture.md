# Architecture

Three views: what runs where, how one edit travels between users on different replicas, and how a change
gets from a pull request to the running cluster. The reasoning behind each choice is in the
[decision records](adr/README.md).

## What runs where

The optional layers (dashed) are added by scripts in [`deploy/kind`](../deploy/kind) and cost extra memory.

```mermaid
flowchart LR
    user([Browser])

    subgraph cluster["kind cluster (3 nodes)"]
        gw["Envoy Gateway<br/>Gateway API routes"]
        fe["Frontend<br/>Next.js"]
        be["Backend x2 to x5<br/>FastAPI, WebSocket sync"]
        vk[("Valkey<br/>edit streams, cursors,<br/>rate limits")]
        pg[("Postgres<br/>CloudNativePG")]

        subgraph opt1["monitoring and autoscaling (optional)"]
            prom["Prometheus"]
            graf["Grafana"]
            keda["KEDA"]
        end
        subgraph opt2["backups (optional)"]
            s3[("SeaweedFS<br/>S3 object store")]
        end
        argo["Argo CD (optional)"]
    end

    git[("GitHub repo<br/>+ container registry")]

    user -->|"app.localhost"| gw --> fe
    user -->|"api.localhost<br/>REST + WebSocket"| gw --> be
    be <--> vk
    be --> pg
    pg -.->|"WAL + base backups"| s3
    be -.->|"/metrics on :9100"| prom
    prom -.-> graf
    prom -.->|"open connections"| keda
    keda -.->|"scales"| be
    argo -.->|"watches main"| git
    argo -.->|"applies the chart"| be
```

The production deployment (Vercel for the frontend, one FastAPI process on a small server) is
unchanged; the cluster is the scalable, observable and recoverable version of the same application.

## How one edit reaches another user

Users editing the same document can be connected to different backend replicas. Each replica keeps its own
in-memory copy of the document, and Valkey carries edits between them. Because Yjs updates commute and are
idempotent, replicas converge whatever order the updates arrive in, and applying one twice is harmless
([decision 1](adr/0001-multi-replica-document-sync.md)).

```mermaid
sequenceDiagram
    autonumber
    participant A as User A
    participant R1 as Backend replica 1
    participant V as Valkey
    participant R2 as Backend replica 2
    participant B as User B
    participant P as Postgres

    A->>R1: edit (Yjs update)
    R1->>R1: apply to its copy
    R1->>V: append to the document's stream
    Note right of R1: other users on replica 1 get the edit directly
    V-->>R2: new stream entry
    R2->>R2: apply (skips its own entries)
    R2-->>B: edit
    Note over R1,R2: every few seconds, each replica merges its copy into Postgres<br/>under a per-document advisory lock, then reads back what others saved
    R1->>P: merge, not overwrite
    R2->>P: merge, not overwrite
    Note over R1,R2: if Valkey is down, replicas converge through Postgres instead,<br/>a few seconds later, and nobody is disconnected
```

## From pull request to running cluster

```mermaid
flowchart TD
    pr["Pull request"] --> ci["CI<br/>backend tests on SQLite and on Postgres+Valkey,<br/>frontend, Helm, shell and workflow lint"]
    ci --> merge["Merge to main"]
    merge --> build["Build both images"]
    build --> scan{"Trivy: fixable<br/>HIGH or CRITICAL?"}
    scan -->|yes| stop["Stop: nothing is published"]
    scan -->|no| push["Publish to GHCR<br/>with provenance and SBOM"]
    push --> sign["Sign the digest with cosign<br/>and verify it"]
    sign --> bump["Bot commits the new tag<br/>into deploy/gitops"]
    bump --> argo["Argo CD syncs"]
    argo --> migrate["Migration Job<br/>(PreSync hook)"]
    migrate --> roll["Rolling update<br/>(never fewer ready pods)"]
```

Pull requests run the same build and scan but publish nothing. Deploying is a git operation: to roll back,
revert the commit that bumped the tag.
