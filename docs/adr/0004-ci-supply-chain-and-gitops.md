# 4. CI, a scanned and attested supply chain, and GitOps deploys

## Problem

Until now every check ran on one laptop, images were built there and tagged by hand, and deploying meant
running a script. Nothing stopped a broken migration, a Helm mistake or a vulnerable dependency from being
merged, and nothing recorded what was running or where it came from.

## Decision

1. **CI runs on every pull request and every push to main**, as separate jobs so a failure points at
   one thing: the backend suite on SQLite; the same suite on real Postgres 17 and Valkey (which also runs
   every migration against a fresh schema and the multi-replica tests); the frontend (typecheck, unit tests,
   production build); the Helm chart (lint, three renderings, schema validation with kubeconform, and a
   negative test that the connection-budget guard from ADR 2 really refuses an unsafe configuration); and
   shellcheck and actionlint over the scripts and workflows.
2. **Third-party actions are pinned to a full commit SHA**, with the version in a comment, and Dependabot
   proposes updates weekly (as it does for pip, npm and the Dockerfiles). A tag can be moved to point at
   different code; a commit cannot. Workflows default to read-only permissions, and only the image job is
   given `packages: write`, and only for pushes, not pull requests.
3. **Images are built, scanned, then published.** The image is built and loaded locally, scanned with Trivy,
   and only if there are no fixable HIGH or CRITICAL vulnerabilities is it pushed, with provenance and an SBOM
   attached as attestations. Tags are the short commit hash (`sha-1a2b3c4`, immutable in practice) and
   `latest` for main. The runtime images drop the tools they don't run with (pip, npm, yarn).
4. **Argo CD deploys from git.** It watches `main`, renders `deploy/helm/mathboard` with
   `deploy/gitops/values-kind.yaml`, and syncs automatically with pruning and self-healing. The last step of
   the image workflow commits the new image tags into that values file, so merging to main is the whole
   deploy. The migration Job, a Helm hook, runs as an Argo CD PreSync hook, ahead of the new pods.
5. **The chart takes an `existingSecret`.** Argo CD renders without cluster access, so the chart's trick of
   reading back its generated `SECRET_KEY` (to keep it stable across upgrades) can't work there and would
   sign everyone out on each sync. `argocd.sh` creates the Secret once instead.
6. **Argo CD manages the application; scripts manage the platform.** Operators, the gateway, the database
   cluster, monitoring and backups are installed by `deploy/kind/*.sh`. Only the chart is GitOps-managed, and
   Argo CD ignores the backend's replica count, which belongs to the autoscaler.

## What this found

Scanning the images the first time, before gating on it, found real problems: the frontend was on Next.js
16.2.10 with two CRITICAL and four HIGH advisories fixed in 16.3.3 (it is a `^16.2.10` range, so the upgrade
was a lockfile bump; typecheck, unit tests and production build pass), plus vulnerable copies of `sharp` and
of the dependencies that ship inside npm and pip. Upgrading Next.js and removing the package managers from
the runtime images brought both images to zero fixable HIGH or CRITICAL findings.

## Alternatives considered

- **Pushing to the cluster from CI** needs cluster credentials in GitHub, and a cluster on a laptop isn't
  reachable from GitHub anyway. Argo CD pulls, which is also the standard model.
- **Argo CD Image Updater or Flux image automation** would update tags without a commit to main. A commit
  is one more thing to trust but leaves an auditable history of exactly what was deployed and when.
- **Signing images with cosign** is the natural next step after provenance attestations.
- **Making lint blocking.** The frontend has 21 existing lint errors (mostly `no-explicit-any` and React-hooks
  rules). CI reports them without failing until they are fixed.

## Consequences

- **The bot commits to main.** If branch protection later requires pull requests, that push will be rejected
  and the bump needs an app token or a bot pull request.
- **GHCR packages are private when first published.** Making them public, once, is a manual step in
  GitHub's package settings (the repository is already public).
- The frontend image bakes in `app.localhost:8080` URLs, so it is for the kind cluster only. The production
  frontend is built by Vercel.
- A scan gate can fail a build on a day when nothing in the repository changed, because a new advisory was
  published. That is the point, but it means a red main is sometimes not the last commit's fault.
- The images are `linux/amd64` only.

## What the first real runs showed

- The whole path worked on its first merge: CI and the image workflow passed on `main`, the bot committed the
  new image tag, and Argo CD synced to that commit and reported Healthy.
- **Argo CD showed permanent drift on the `HTTPRoute`.** The Kubernetes API server fills in fields the chart
  left out (`group` and `kind` on references, `weight`, and a default path match), so the live object never
  equalled the rendered one. The fix was to write those defaults into the template explicitly. The general
  rule: a chart that a GitOps tool syncs should render what the API server would store.
- **Dependabot opened eleven pull requests within minutes, and CI judged them.** It correctly rejected the
  Vitest 5 bump (its peer dependency needs `@types/node` 22 or newer, and the project is on 20) and a Node 25
  base-image bump that failed the image build. Four unrelated bumps also failed a backend test, which turned
  out to be a real intermittent bug in the room registry, not a problem with those bumps (finding 7 in
  [deploy/tests/README.md](../../deploy/tests/README.md)).
