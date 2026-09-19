# Demo video: script and checklist

A four-to-five-minute walkthrough, built only from commands that exist in this repository. The aim is not
to show every feature; it is to let a viewer see, in a few minutes, that this is a real system that survives
failures, explains itself, deploys from git and restores from backup.

## Before you record

```
bash deploy/kind/up.sh                      # the cluster and the app
bash deploy/kind/observability.sh up        # Prometheus, Grafana, KEDA (about 0.5 GiB extra)
bash deploy/kind/backups.sh up              # backups
bash deploy/kind/argocd.sh up               # GitOps (make the GHCR packages public first)
bash deploy/kind/status.sh                  # everything above should say ON
```

- Argo CD owns the application once it is on, and the autoscaler is then switched with a value in git
  (`autoscaling.enabled: true` in `deploy/gitops/values-kind.yaml`). Doing that as a pull request before the
  recording gives you the GitOps story for free. Otherwise skip `argocd.sh` and show it from screenshots.
- Sign up two users at http://app.localhost:8080 and create one document shared with both.
- Open, in this order of tabs: the app (two browser windows side by side), Grafana
  (`bash deploy/kind/observability.sh grafana`, then http://localhost:3000, dashboard **Mathboard**), the
  Argo CD UI (`bash deploy/kind/argocd.sh ui`), the repository's Actions tab, and `docs/architecture.md`.
- Terminal: dark theme, font size around 18, one pane. Close anything that shows a password: the Argo CD
  and Grafana admin passwords are printed by the `ui` and `grafana` commands, so run those before recording.
- Do one full dry run. The chaos and autoscale steps take real time; plan to speed those up or cut them.

## The script

| Time | Show | Say |
|---|---|---|
| 0:00 | Two browser windows on the same document. Type LaTeX in one; it renders live in the other, with the other person's cursor. | "Mathboard is a collaborative LaTeX editor. I built it, and then I wanted to find out what it would take to run it properly, so I put it on Kubernetes." |
| 0:25 | `docs/architecture.md`, first diagram. `kubectl get pods`. | "Several backend replicas sit behind a gateway. The interesting part is that two people on the same document can be on different replicas, so the replicas share edits through Valkey and merge into Postgres. Yjs updates commute, so they converge whatever order they arrive in." |
| 1:00 | `bash deploy/tests/run-chaos.sh -s hard` while typing in the editor. | "I don't trust that on faith, so there is a chaos test. It force-kills the busiest backend while twelve simulated users edit one document. The pass condition is strict: every client has every edit, all clients are identical, and Postgres has every block." Show the PASS lines. |
| 1:45 | Grafana dashboard, then `bash deploy/tests/run-autoscale.sh --vus 220 --after 0` and watch replicas and connections. | "Every replica exports metrics, so I can see what it is doing. KEDA scales the backend on open WebSocket connections: 220 simulated users take it from 2 replicas to 4, with no dropped connection, and it scales back down slowly because removing a replica drops its sockets." |
| 2:30 | The Actions tab: a green run of **CI** and **Images**. Then the Trivy step. | "Every pull request runs the backend tests against real Postgres and Valkey, the frontend, and the Helm chart. Images are built and scanned before they're published, and the scanner has already caught a critical Next.js vulnerability in my own app." |
| 3:00 | Argo CD UI: **mathboard**, Synced and Healthy. `git log --oneline -5` showing the bot's `Deploy ...` commit. | "Deploying is a git operation. Merge to main, CI publishes the image and commits the new tag, and Argo CD applies it. Rolling back is reverting a commit." |
| 3:30 | `bash deploy/tests/run-restore-drill.sh` (speed up the wait). | "Backups are only real if you've restored them. This writes rows, takes a backup, writes more, and restores a second database to a moment in between. It passes only if exactly the right rows come back." Show PASS and the timings. |
| 4:15 | `docs/adr/README.md` or the README's results table. | "Every decision has a written record with what I considered and what it costs, and the load tests found real problems I fixed along the way. The honest limits are in the README too." |

## Things worth saying out loud

- The load tests **failed at first**, and what they found (Postgres running out of connections, saving that
  got slower as documents grew, Kubernetes killing busy pods) is the interesting story.
- CI found a flaky test in the first hour it ran.
- Everything runs on free tools, and the production server still runs the plain app on a 4 GB laptop.

## If something goes wrong on camera

- The results are saved in [`deploy/tests/results`](../deploy/tests/results), so any step can be shown from
  its recorded output instead of live.
- `bash deploy/kind/status.sh` shows what is on and what is not.
- Argo CD showing OutOfSync right after a change is normal for up to two minutes; refresh it from the UI.
