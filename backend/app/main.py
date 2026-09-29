from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, init_db
from .schemas import HealthOut, MessageCreate, MessageOut


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="我的第一个全栈网站 API",
    description="React + FastAPI + SQLite 最小完整项目",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def row_to_message(row) -> MessageOut:
    return MessageOut(
        id=row["id"],
        name=row["name"],
        content=row["content"],
        created_at=datetime.fromisoformat(row["created_at"]),
    )


@app.get("/api/health", response_model=HealthOut)
def health() -> HealthOut:
    return HealthOut(status="ok")


@app.get("/api/messages", response_model=list[MessageOut])
def list_messages() -> list[MessageOut]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, name, content, created_at
            FROM messages
            ORDER BY id DESC
            """
        ).fetchall()
    return [row_to_message(row) for row in rows]


@app.post(
    "/api/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
def create_message(payload: MessageCreate) -> MessageOut:
    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO messages (name, content, created_at)
            VALUES (?, ?, ?)
            """,
            (payload.name, payload.content, created_at),
        )
        row = connection.execute(
            """
            SELECT id, name, content, created_at
            FROM messages
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="留言保存失败",
        )
    return row_to_message(row)
