import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
assert DATABASE_URL

is_sqlite = DATABASE_URL.startswith("sqlite")

engine = create_engine(
    DATABASE_URL,
    # FastAPI runs sync path operations in a thread pool, and SQLAlchemy's
    # connection pool is not thread-affine, so a pooled sqlite3 connection
    # can be checked out on a different thread than the one that created it.
    connect_args={"check_same_thread": False} if is_sqlite else {},
    pool_pre_ping=True  # good practice for Postgres
)

if is_sqlite:
    from sqlalchemy import event

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()