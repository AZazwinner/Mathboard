import os
import tempfile

import pytest

# Must be set before any app module is imported - db/database.py and
# db/core/auth/utils/token.py both assert on these at import time.
_TMP_DB_FD, _TMP_DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_TMP_DB_FD)

os.environ["SECRET_KEY"] = "test-secret-key-do-not-use-in-production"
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB_PATH}"
os.environ["CORS_ORIGINS"] = ""
os.environ.pop("RESEND_API_KEY", None)

from db.base import Base
from db.database import engine, SessionLocal

# Import every model module so Base.metadata is aware of all tables before create_all().
from db.core.auth import models as _auth_models  # noqa: F401
from db.modules.users import models as _user_models  # noqa: F401
from db.modules.docs import models as _doc_models  # noqa: F401


@pytest.fixture(scope="session", autouse=True)
def _setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()
    os.remove(_TMP_DB_PATH)


@pytest.fixture(autouse=True)
def _clean_tables():
    """Each test starts with empty tables, regardless of what a previous test committed."""
    yield
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """The rate limiter's login/signup throttle state is a module-level dict shared
    across the whole process - reset it so one test's lockout can't bleed into another."""
    from db.core.auth import rate_limit
    rate_limit._attempts.clear()
    rate_limit._locked_until.clear()
    yield


@pytest.fixture()
def db_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as c:
        yield c
