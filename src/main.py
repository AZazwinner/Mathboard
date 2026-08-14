from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from db.modules.liveshare.ydoc_room import registry as yroom_registry

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # flush every open Yjs room before the process exits - without this,
    # edits sitting in an unflushed debounce window are lost on shutdown
    yroom_registry.flush_all()

app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:12000",  # Next.js dev server
    "http://127.0.0.1:12000",
    "https://mathboard-git-hosting-apolloiheos-projects.vercel.app",
    "https://mathboard-nine.vercel.app",
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

## -- Uvicorn

def main():
    pass

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=12001, reload=False)
