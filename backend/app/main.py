from contextlib import asynccontextmanager
from datetime import datetime
import sqlite3
from typing import Annotated
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import DatabaseIntegrityError, get_connection, init_db
from .schemas import (
    CommentCreate,
    CommentOut,
    CommentUpdate,
    HealthOut,
    LikeOut,
    LoginIn,
    PostAuthorOut,
    PostCreate,
    PostOut,
    PostUpdate,
    ProfileOut,
    ProfileUpdate,
    RegisterIn,
    TagOut,
    UserOut,
)
from .security import (
    SESSION_COOKIE,
    clear_session_cookie,
    create_session,
    delete_session,
    get_optional_user,
    hash_password,
    require_user,
    set_session_cookie,
    utc_now_iso,
    verify_password,
)


POST_SELECT = """
    SELECT
        p.id,
        p.content,
        p.created_at,
        p.updated_at,
        p.user_id AS post_user_id,
        p.author_name,
        u.username AS author_username,
        u.display_name AS author_display_name,
        u.role AS author_role,
        COALESCE((
            SELECT GROUP_CONCAT(ordered_tags.name, '||')
            FROM (
                SELECT t.name
                FROM post_tags AS pt
                JOIN tags AS t ON t.id = pt.tag_id
                WHERE pt.post_id = p.id
                ORDER BY t.name
            ) AS ordered_tags
        ), '') AS tag_names,
        (SELECT COUNT(*) FROM post_likes AS pl WHERE pl.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM comments AS c WHERE c.post_id = p.id) AS comment_count,
        EXISTS(
            SELECT 1
            FROM post_likes AS pl2
            WHERE pl2.post_id = p.id AND pl2.user_id = ?
        ) AS liked_by_me
    FROM posts AS p
    LEFT JOIN users AS u ON u.id = p.user_id
"""

COMMENT_SELECT = """
    SELECT
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.created_at,
        c.updated_at,
        u.username AS author_username,
        u.display_name AS author_display_name,
        u.role AS author_role
    FROM comments AS c
    JOIN users AS u ON u.id = c.user_id
"""


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="微光社区 API",
    description="React + FastAPI + SQLite 个人留言社区",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def user_from_row(row: sqlite3.Row) -> UserOut:
    return UserOut(
        id=row["id"],
        username=row["username"],
        display_name=row["display_name"],
        bio=row["bio"],
        role=row["role"],
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def author_from_post_row(row: sqlite3.Row) -> PostAuthorOut:
    author_id = row["post_user_id"]
    return PostAuthorOut(
        id=author_id,
        username=row["author_username"],
        display_name=row["author_display_name"] or row["author_name"] or "历史访客",
        role=row["author_role"] or "guest",
        is_legacy=author_id is None,
    )


def author_from_comment_row(row: sqlite3.Row) -> PostAuthorOut:
    return PostAuthorOut(
        id=row["user_id"],
        username=row["author_username"],
        display_name=row["author_display_name"] or "匿名用户",
        role=row["author_role"] or "guest",
        is_legacy=False,
    )


def serialize_post(row: sqlite3.Row, current_user: UserOut | None) -> PostOut:
    owner_id = row["post_user_id"]
    can_manage = bool(
        current_user
        and (current_user.role == "admin" or owner_id == current_user.id)
    )
    tags = row["tag_names"].split("||") if row["tag_names"] else []
    return PostOut(
        id=row["id"],
        content=row["content"],
        tags=tags,
        author=author_from_post_row(row),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
        like_count=row["like_count"],
        comment_count=row["comment_count"],
        liked_by_me=bool(row["liked_by_me"]),
        can_edit=can_manage,
        can_delete=can_manage,
    )


def serialize_comment(row: sqlite3.Row, current_user: UserOut | None) -> CommentOut:
    can_manage = bool(
        current_user
        and (current_user.role == "admin" or row["user_id"] == current_user.id)
    )
    return CommentOut(
        id=row["id"],
        post_id=row["post_id"],
        content=row["content"],
        author=author_from_comment_row(row),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
        can_edit=can_manage,
        can_delete=can_manage,
    )

def get_post_row(
    connection: sqlite3.Connection,
    post_id: int,
    current_user: UserOut | None,
) -> sqlite3.Row | None:
    return connection.execute(
        f"{POST_SELECT} WHERE p.id = ?",
        (current_user.id if current_user else -1, post_id),
    ).fetchone()


def get_comment_row(
    connection: sqlite3.Connection,
    comment_id: int,
) -> sqlite3.Row | None:
    return connection.execute(
        f"{COMMENT_SELECT} WHERE c.id = ?",
        (comment_id,),
    ).fetchone()


def set_post_tags(
    connection: sqlite3.Connection,
    post_id: int,
    tags: list[str],
) -> None:
    connection.execute("DELETE FROM post_tags WHERE post_id = ?", (post_id,))
    created_at = utc_now_iso()
    for tag in tags:
        connection.execute(
            """
            INSERT INTO tags (name, created_at)
            VALUES (?, ?)
            ON CONFLICT(name) DO NOTHING
            """,
            (tag, created_at),
        )
        tag_row = connection.execute(
            "SELECT id FROM tags WHERE name = ?",
            (tag,),
        ).fetchone()
        if tag_row:
            connection.execute(
                """
                INSERT INTO post_tags (post_id, tag_id)
                VALUES (?, ?)
                ON CONFLICT DO NOTHING
                """,
                (post_id, tag_row["id"]),
            )


def escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@app.get("/api/health", response_model=HealthOut)
def health() -> HealthOut:
    return HealthOut(status="ok")


@app.post(
    "/api/auth/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterIn, response: Response) -> UserOut:
    created_at = utc_now_iso()
    try:
        with get_connection() as connection:
            user_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            role = "admin" if user_count == 0 else "member"
            user_row = connection.execute(
                """
                INSERT INTO users (
                    username, display_name, bio, password_hash, role, created_at
                )
                VALUES (?, ?, '', ?, ?, ?)
                RETURNING id
                """,
                (
                    payload.username,
                    payload.display_name,
                    hash_password(payload.password),
                    role,
                    created_at,
                ),
            )
            user = UserOut(
                id=user_row.fetchone()["id"],
                username=payload.username,
                display_name=payload.display_name,
                bio="",
                role=role,
                created_at=datetime.fromisoformat(created_at),
            )
            token = create_session(connection, user.id)
    except DatabaseIntegrityError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="这个用户名已经被使用",
        ) from error

    set_session_cookie(response, token)
    return user


@app.post("/api/auth/login", response_model=UserOut)
def login(payload: LoginIn, response: Response) -> UserOut:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, username, display_name, bio, password_hash, role, created_at
            FROM users
            WHERE username = ?
            """,
            (payload.username,),
        ).fetchone()
        if row is None or not verify_password(payload.password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码不正确",
            )
        token = create_session(connection, row["id"])
        user = user_from_row(row)

    set_session_cookie(response, token)
    return user


@app.post("/api/auth/logout")
def logout(request: Request, response: Response) -> dict[str, str]:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        delete_session(token)
    clear_session_cookie(response)
    return {"status": "ok"}


@app.get("/api/auth/me", response_model=UserOut | None)
def auth_me(
    current_user: Annotated[UserOut | None, Depends(get_optional_user)],
) -> UserOut | None:
    return current_user


@app.patch("/api/auth/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    current_user: Annotated[UserOut, Depends(require_user)],
) -> UserOut:
    with get_connection() as connection:
        connection.execute(
            """
            UPDATE users
            SET display_name = ?, bio = ?
            WHERE id = ?
            """,
            (payload.display_name, payload.bio, current_user.id),
        )
        row = connection.execute(
            """
            SELECT id, username, display_name, bio, role, created_at
            FROM users
            WHERE id = ?
            """,
            (current_user.id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user_from_row(row)


@app.get("/api/posts", response_model=list[PostOut])
def list_posts(
    current_user: Annotated[UserOut | None, Depends(get_optional_user)],
    q: str | None = Query(default=None, max_length=60),
    tag: str | None = Query(default=None, max_length=20),
    author: str | None = Query(default=None, max_length=24),
    limit: int = Query(default=40, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[PostOut]:
    conditions: list[str] = []
    params: list[object] = [current_user.id if current_user else -1]

    if q and q.strip():
        pattern = f"%{escape_like(q.strip())}%"
        conditions.append(
            """
            (
                p.content LIKE ? ESCAPE '\\'
                OR p.author_name LIKE ? ESCAPE '\\'
                OR u.display_name LIKE ? ESCAPE '\\'
                OR u.username LIKE ? ESCAPE '\\'
                OR EXISTS (
                    SELECT 1
                    FROM post_tags AS search_pt
                    JOIN tags AS search_tag ON search_tag.id = search_pt.tag_id
                    WHERE search_pt.post_id = p.id
                      AND search_tag.name LIKE ? ESCAPE '\\'
                )
            )
            """
        )
        params.extend([pattern, pattern, pattern, pattern, pattern])

    if tag and tag.strip():
        conditions.append(
            """
            EXISTS (
                SELECT 1
                FROM post_tags AS filter_pt
                JOIN tags AS filter_tag ON filter_tag.id = filter_pt.tag_id
                WHERE filter_pt.post_id = p.id AND filter_tag.name = ?
            )
            """
        )
        params.append(tag.strip().lstrip("#").lower())

    if author and author.strip():
        conditions.append("u.username = ?")
        params.append(author.strip().lower())

    where_clause = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    params.extend([limit, offset])

    with get_connection() as connection:
        rows = connection.execute(
            f"{POST_SELECT}{where_clause} ORDER BY p.id DESC LIMIT ? OFFSET ?",
            params,
        ).fetchall()
    return [serialize_post(row, current_user) for row in rows]


@app.post(
    "/api/posts",
    response_model=PostOut,
    status_code=status.HTTP_201_CREATED,
)
def create_post(
    payload: PostCreate,
    current_user: Annotated[UserOut, Depends(require_user)],
) -> PostOut:
    created_at = utc_now_iso()
    with get_connection() as connection:
        post_row = connection.execute(
            """
            INSERT INTO posts (user_id, author_name, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id
            """,
            (
                current_user.id,
                current_user.display_name,
                payload.content,
                created_at,
                created_at,
            ),
        )
        post_id = post_row.fetchone()["id"]
        set_post_tags(connection, post_id, payload.tags)
        row = get_post_row(connection, post_id, current_user)

    if row is None:
        raise HTTPException(status_code=500, detail="帖子保存失败")
    return serialize_post(row, current_user)


@app.get("/api/posts/{post_id}", response_model=PostOut)
def get_post(
    post_id: int,
    current_user: Annotated[UserOut | None, Depends(get_optional_user)],
) -> PostOut:
    with get_connection() as connection:
        row = get_post_row(connection, post_id, current_user)
    if row is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return serialize_post(row, current_user)


@app.patch("/api/posts/{post_id}", response_model=PostOut)
def update_post(
    post_id: int,
    payload: PostUpdate,
    current_user: Annotated[UserOut, Depends(require_user)],
) -> PostOut:
    updated_at = utc_now_iso()
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id, user_id FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="帖子不存在")
        if current_user.role != "admin" and existing["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="你不能编辑这条帖子")

        connection.execute(
            "UPDATE posts SET content = ?, updated_at = ? WHERE id = ?",
            (payload.content, updated_at, post_id),
        )
        set_post_tags(connection, post_id, payload.tags)
        row = get_post_row(connection, post_id, current_user)

    if row is None:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return serialize_post(row, current_user)


@app.delete("/api/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_user: Annotated[UserOut, Depends(require_user)],
) -> Response:
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id, user_id FROM posts WHERE id = ?",
            (post_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="帖子不存在")
        if current_user.role != "admin" and existing["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="你不能删除这条帖子")
        connection.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/posts/{post_id}/like", response_model=LikeOut)
def toggle_like(
    post_id: int,
    current_user: Annotated[UserOut, Depends(require_user)],
) -> LikeOut:
    with get_connection() as connection:
        if connection.execute("SELECT 1 FROM posts WHERE id = ?", (post_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="帖子不存在")

        existing = connection.execute(
            "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
            (post_id, current_user.id),
        ).fetchone()
        if existing:
            connection.execute(
                "DELETE FROM post_likes WHERE post_id = ? AND user_id = ?",
                (post_id, current_user.id),
            )
            liked = False
        else:
            connection.execute(
                """
                INSERT INTO post_likes (post_id, user_id, created_at)
                VALUES (?, ?, ?)
                """,
                (post_id, current_user.id, utc_now_iso()),
            )
            liked = True

        like_count = connection.execute(
            "SELECT COUNT(*) FROM post_likes WHERE post_id = ?",
            (post_id,),
        ).fetchone()[0]

    return LikeOut(liked=liked, like_count=like_count)


@app.get("/api/posts/{post_id}/comments", response_model=list[CommentOut])
def list_comments(
    post_id: int,
    current_user: Annotated[UserOut | None, Depends(get_optional_user)],
) -> list[CommentOut]:
    with get_connection() as connection:
        if connection.execute("SELECT 1 FROM posts WHERE id = ?", (post_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="帖子不存在")
        rows = connection.execute(
            f"{COMMENT_SELECT} WHERE c.post_id = ? ORDER BY c.id ASC LIMIT 200",
            (post_id,),
        ).fetchall()
    return [serialize_comment(row, current_user) for row in rows]


@app.post(
    "/api/posts/{post_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    post_id: int,
    payload: CommentCreate,
    current_user: Annotated[UserOut, Depends(require_user)],
) -> CommentOut:
    created_at = utc_now_iso()
    with get_connection() as connection:
        if connection.execute("SELECT 1 FROM posts WHERE id = ?", (post_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="帖子不存在")
        comment_row = connection.execute("""
            INSERT INTO comments (post_id, user_id, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id
            """,
            (post_id, current_user.id, payload.content, created_at, created_at),
        )
        row = get_comment_row(connection, comment_row.fetchone()["id"])

    if row is None:
        raise HTTPException(status_code=500, detail="评论保存失败")
    return serialize_comment(row, current_user)


@app.patch("/api/comments/{comment_id}", response_model=CommentOut)
def update_comment(
    comment_id: int,
    payload: CommentUpdate,
    current_user: Annotated[UserOut, Depends(require_user)],
) -> CommentOut:
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id, user_id FROM comments WHERE id = ?",
            (comment_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="评论不存在")
        if current_user.role != "admin" and existing["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="你不能编辑这条评论")

        connection.execute(
            "UPDATE comments SET content = ?, updated_at = ? WHERE id = ?",
            (payload.content, utc_now_iso(), comment_id),
        )
        row = get_comment_row(connection, comment_id)

    if row is None:
        raise HTTPException(status_code=404, detail="评论不存在")
    return serialize_comment(row, current_user)


@app.delete("/api/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    current_user: Annotated[UserOut, Depends(require_user)],
) -> Response:
    with get_connection() as connection:
        existing = connection.execute(
            "SELECT id, user_id FROM comments WHERE id = ?",
            (comment_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="评论不存在")
        if current_user.role != "admin" and existing["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="你不能删除这条评论")
        connection.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/tags", response_model=list[TagOut])
def list_tags(
    limit: int = Query(default=20, ge=1, le=50),
) -> list[TagOut]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT t.name, COUNT(pt.post_id) AS post_count
            FROM tags AS t
            JOIN post_tags AS pt ON pt.tag_id = t.id
            GROUP BY t.id, t.name
            HAVING COUNT(pt.post_id) > 0
            ORDER BY post_count DESC, t.name ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        TagOut(name=row["name"], post_count=row["post_count"])
        for row in rows
    ]


@app.get("/api/users/{username}", response_model=ProfileOut)
def get_profile(
    username: str,
    current_user: Annotated[UserOut | None, Depends(get_optional_user)],
) -> ProfileOut:
    normalized_username = username.strip().lower()
    with get_connection() as connection:
        user_row = connection.execute(
            """
            SELECT id, username, display_name, bio, role, created_at
            FROM users
            WHERE username = ?
            """,
            (normalized_username,),
        ).fetchone()
        if user_row is None:
            raise HTTPException(status_code=404, detail="用户不存在")

        post_count = connection.execute(
            "SELECT COUNT(*) FROM posts WHERE user_id = ?",
            (user_row["id"],),
        ).fetchone()[0]
        received_like_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM post_likes AS pl
            JOIN posts AS p ON p.id = pl.post_id
            WHERE p.user_id = ?
            """,
            (user_row["id"],),
        ).fetchone()[0]
        comment_count = connection.execute(
            "SELECT COUNT(*) FROM comments WHERE user_id = ?",
            (user_row["id"],),
        ).fetchone()[0]
        post_rows = connection.execute(
            f"""
            {POST_SELECT}
            WHERE p.user_id = ?
            ORDER BY p.id DESC
            LIMIT 30
            """,
            (
                current_user.id if current_user else -1,
                user_row["id"],
            ),
        ).fetchall()

    return ProfileOut(
        user=user_from_row(user_row),
        post_count=post_count,
        received_like_count=received_like_count,
        comment_count=comment_count,
        posts=[serialize_post(row, current_user) for row in post_rows],
    )


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount(
        "/",
        StaticFiles(directory=FRONTEND_DIST, html=True),
        name="frontend",
    )
