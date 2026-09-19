# Setup

## Environment

```
python3 -m venv venv
source venv/bin/activate
pip install -r src/requirements.txt
```

### Database
Postgres is the supported database. On Ubuntu:

```
sudo apt install postgresql
sudo -u postgres psql -c "CREATE USER mathboard WITH PASSWORD 'change-me'"
sudo -u postgres psql -c "CREATE DATABASE mathboard OWNER mathboard"
```

Then set `DATABASE_URL=postgresql://mathboard:change-me@localhost:5432/mathboard`.

Schema is managed by Alembic, not by the app itself. After installing deps (and
any time you pull migration changes), from `src/`:

```
alembic upgrade head
```

#### Moving an existing SQLite database to Postgres
With Postgres migrated as above and empty, from the repo root:

```
python scripts/sqlite_to_postgres.py --source src/mathboard.db --target postgresql://mathboard:change-me@localhost:5432/mathboard
```

The source file is opened read-only and the copy is one transaction, so a failure
leaves Postgres untouched. It checks row counts and resets the id sequences.
Stop the backend first so no writes land in SQLite mid-copy. Add `--replace` to
wipe the target's tables and copy again.

If the SQLite file predates Alembic (no `alembic_version` table), run this once
against it before copying so its schema is stamped:

```
DATABASE_URL=sqlite:///./mathboard.db alembic stamp f43e528ab149
DATABASE_URL=sqlite:///./mathboard.db alembic upgrade head
```

#### SQLite
`DATABASE_URL=sqlite:///./mathboard.db` still works for quick local runs. It is
single-process only, so it can't back more than one backend replica.

### .env
PROD=false/true
SECRET_KEY=
DATABASE_URL=

```cd app && npm i```

## Docker
Runs Postgres, the migrations, the backend and the frontend together, with no local Python or Node needed:

```
docker compose up --build
```

App: localhost:12000, API: localhost:12001. Migrations run automatically before the backend starts.
The dev defaults (database password, `SECRET_KEY`) are for local use only; copy `.env.example` to `.env` to override them.

This also starts Valkey, which lets several backend replicas share live edits (see `docs/adr/0001-multi-replica-document-sync.md`).

Run the backend tests in a container against Postgres and Valkey:

```
docker compose --profile test run --rm backend-test
```

The frontend bakes its `NEXT_PUBLIC_*` URLs in at build time (see `args` in `docker-compose.yml`), so an image built for one environment won't work in another.

## Kubernetes
`bash deploy/kind/up.sh` runs the whole stack on a local kind cluster. See [deploy/README.md](deploy/README.md).

## Test
`cd app && PORT=12000 npm run dev`
`cd src && python main.py`

Backend tests (`cd src && pip install -r requirements-dev.txt && pytest`) use a
temporary SQLite file by default. To run them against Postgres, with the schema
built by Alembic:

```
TEST_DATABASE_URL=postgresql://mathboard:change-me@localhost:5432/mathboard_test pytest
```

App: localhost:12000
API: localhost:12001
