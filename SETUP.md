# Setup

## Environment

```
python3 -m venv venv
source venv/bin/activate
pip install -r src/requirements.txt
```

### Database
Schema is managed by Alembic, not by the app itself. After installing deps (and
any time you pull migration changes), from `src/`:

```
alembic upgrade head
```

A fresh clone with no `mathboard.db` yet: this creates the whole schema from
scratch. If you already have a `mathboard.db` from before Alembic was added
(no `alembic_version` table), run this one-time step first so Alembic doesn't
try to re-create tables that already exist:

```
alembic stamp f43e528ab149
alembic upgrade head
```

### .env
PROD=false/true
SECRET_KEY=
DATABASE_URL=

```cd app && npm i```

## Test
`cd app && PORT=12000 npm run dev`
`cd src && python main.py`

App: localhost:12000
API: localhost:12001
