import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from db.modules.liveshare.ydoc_room import registry as yroom_registry

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Flush every open Yjs room so edits in an unflushed debounce window aren't lost.
    yroom_registry.flush_all()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
def health():
    return {"status": "ok"}

# Allows a new frontend domain to be allowlisted via env var instead of a code change.
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
origins = [
    "http://localhost:12000",  # Next.js dev server
    "http://127.0.0.1:12000",
    "https://mathboard-git-hosting-apolloiheos-projects.vercel.app",
    "https://mathboard-nine.vercel.app",
    *_extra_origins,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # or ["*"] for dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Routers
from modules.test.routes import router as test_router
from db.modules.docs.routes import router as doc_router
from db.modules.users.routes import router as user_router
from db.modules.liveshare.routes import router as liveshare_router

for router in [
    test_router,
    doc_router,
    user_router,
    liveshare_router
]:
    app.include_router(router)

## -- Database
# TODO: switch to migrations
from db.base import Base
from db.database import engine
Base.metadata.create_all(bind=engine)

# create_all doesn't add columns to existing tables, so new columns need a one-off ADD COLUMN.
from sqlalchemy import inspect, text as sql_text

_inspector = inspect(engine)
if "documents" in _inspector.get_table_names():
    _doc_columns = {col["name"] for col in _inspector.get_columns("documents")}
    if "deleted_at" not in _doc_columns:
        with engine.begin() as _conn:
            _conn.execute(sql_text("ALTER TABLE documents ADD COLUMN deleted_at DATETIME"))

## -- Uvicorn

def main():
    pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", 12001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
