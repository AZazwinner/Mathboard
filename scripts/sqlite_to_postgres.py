"""One-off copy of a Mathboard SQLite database into an empty, already-migrated Postgres database.

    cd src && alembic upgrade head          # with DATABASE_URL pointing at Postgres
    python scripts/sqlite_to_postgres.py --source src/mathboard.db --target postgresql://user:pw@host/db

Everything runs in one transaction on the target, so a failure leaves it untouched.
The source file is opened read-only. Use --replace to wipe the target's tables first.
"""

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from sqlalchemy import Integer, create_engine, func, inspect, select, text

from db.base import Base
from db.core.auth import models as _auth_models  # noqa: F401
from db.modules.users import models as _user_models  # noqa: F401
from db.modules.docs import models as _doc_models  # noqa: F401
from db.url import normalize_database_url

BATCH_SIZE = 1000


def fail(message: str) -> None:
    print(f"sqlite_to_postgres: {message}", file=sys.stderr)
    sys.exit(1)


def open_source(path: Path):
    if not path.is_file():
        fail(f"source database not found: {path}")
    return create_engine(f"sqlite:///file:{path.resolve().as_posix()}?mode=ro&uri=true")


def check_source_schema(source) -> None:
    inspector = inspect(source)
    existing_tables = set(inspector.get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            fail(f"source is missing table '{table.name}'")
        source_columns = {c["name"] for c in inspector.get_columns(table.name)}
        missing = {c.name for c in table.columns} - source_columns
        if missing:
            fail(
                f"source table '{table.name}' is missing columns {sorted(missing)}; "
                "run `alembic upgrade head` against the SQLite file first"
            )


def check_target_ready(conn, replace: bool) -> None:
    if not inspect(conn).has_table("alembic_version"):
        fail("target has no alembic_version table; run `alembic upgrade head` against it first")
    populated = [
        t.name
        for t in Base.metadata.sorted_tables
        if conn.execute(select(func.count()).select_from(t)).scalar_one() > 0
    ]
    if populated and not replace:
        fail(f"target tables already contain rows ({', '.join(populated)}); pass --replace to wipe them")
    if populated:
        names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


def copy_table(source_conn, target_conn, table) -> int:
    copied = 0
    result = source_conn.execute(select(table))
    while True:
        rows = result.fetchmany(BATCH_SIZE)
        if not rows:
            return copied
        target_conn.execute(table.insert(), [dict(row._mapping) for row in rows])
        copied += len(rows)


def reset_sequences(conn) -> None:
    for table in Base.metadata.sorted_tables:
        pk_columns = list(table.primary_key.columns)
        if len(pk_columns) != 1 or not isinstance(pk_columns[0].type, Integer):
            continue
        column = pk_columns[0].name
        conn.execute(text(f"""
            SELECT setval(
                pg_get_serial_sequence('"{table.name}"', '{column}'),
                COALESCE((SELECT MAX("{column}") FROM "{table.name}"), 1),
                (SELECT MAX("{column}") FROM "{table.name}") IS NOT NULL
            )
        """))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", type=Path, default=ROOT / "src" / "mathboard.db")
    parser.add_argument("--target", default=os.getenv("DATABASE_URL"))
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()

    if not args.target:
        fail("no target: pass --target or set DATABASE_URL")
    target_url = normalize_database_url(args.target)
    if not target_url.startswith("postgresql"):
        fail("target must be a postgresql:// URL")

    source = open_source(args.source)
    target = create_engine(target_url)
    check_source_schema(source)

    counts: dict[str, int] = {}
    with source.connect() as source_conn, target.begin() as target_conn:
        check_target_ready(target_conn, args.replace)
        for table in Base.metadata.sorted_tables:
            counts[table.name] = copy_table(source_conn, target_conn, table)
        reset_sequences(target_conn)

        for table in Base.metadata.sorted_tables:
            in_target = target_conn.execute(select(func.count()).select_from(table)).scalar_one()
            in_source = source_conn.execute(select(func.count()).select_from(table)).scalar_one()
            if in_target != in_source:
                fail(f"row count mismatch in '{table.name}': source {in_source}, target {in_target}")

    for name, count in counts.items():
        print(f"{name:24} {count:>8}")
    print("done")


if __name__ == "__main__":
    main()
