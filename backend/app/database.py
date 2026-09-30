from contextlib import contextmanager
from pathlib import Path
import os
import re
import sqlite3
from typing import Any, Iterator

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SQLITE_PATH = Path(os.environ.get("APP_DB_PATH", DATA_DIR / "app.db")).resolve()
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))

if IS_POSTGRES:
    try:
        import psycopg
        from psycopg.rows import dict_row
    except ImportError as error:
        raise RuntimeError(
            "DATABASE_URL is set but psycopg is not installed"
        ) from error
    DatabaseIntegrityError = psycopg.IntegrityError
else:
    DatabaseIntegrityError = sqlite3.IntegrityError


def _postgres_sql(query: str) -> str:
    query = query.replace("?", "%s")
    return re.sub(r"GROUP_CONCAT\(", "STRING_AGG(", query, flags=re.IGNORECASE)


class PostgresConnection:
    def __init__(self, url: str) -> None:
        self._connection = psycopg.connect(url, row_factory=dict_row)

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> Any:
        return self._connection.execute(_postgres_sql(query), params)

    def executescript(self, script: str) -> None:
        for statement in script.split(";"):
            statement = statement.strip()
            if statement:
                self._connection.execute(statement)

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()


@contextmanager
def get_connection() -> Iterator[Any]:
    if IS_POSTGRES:
        connection = PostgresConnection(DATABASE_URL)
    else:
        SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(SQLITE_PATH, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _ensure_sqlite_column(
    connection: sqlite3.Connection,
    table: str,
    column: str,
    declaration: str,
) -> None:
    columns = {
        row["name"]
        for row in connection.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if column not in columns:
        connection.execute(
            f"ALTER TABLE {table} ADD COLUMN {column} {declaration}"
        )


def _init_sqlite(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            bio TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            author_name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS post_likes (
            post_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (post_id, user_id),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS post_tags (
            post_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (post_id, tag_id),
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
            ON auth_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_posts_created
            ON posts(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_posts_user
            ON posts(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_comments_post
            ON comments(post_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_post_likes_post
            ON post_likes(post_id);
        CREATE INDEX IF NOT EXISTS idx_post_tags_tag
            ON post_tags(tag_id, post_id);
        """
    )
    _ensure_sqlite_column(connection, "users", "bio", "TEXT NOT NULL DEFAULT ''")

    has_messages = connection.execute(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = 'messages'
        """
    ).fetchone()
    post_count = connection.execute("SELECT COUNT(*) AS count FROM posts").fetchone()["count"]
    if has_messages and post_count == 0:
        connection.execute(
            """
            INSERT INTO posts (user_id, author_name, content, created_at, updated_at)
            SELECT NULL, name, content, created_at, created_at
            FROM messages
            ORDER BY id ASC
            """
        )


def _init_postgres(connection: PostgresConnection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            bio TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            author_name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS comments (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS post_likes (
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL,
            PRIMARY KEY (post_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS post_tags (
            post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (post_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
            ON auth_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_posts_created
            ON posts(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_posts_user
            ON posts(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_comments_post
            ON comments(post_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_post_likes_post
            ON post_likes(post_id);
        CREATE INDEX IF NOT EXISTS idx_post_tags_tag
            ON post_tags(tag_id, post_id);
        """
    )


def init_db() -> None:
    if IS_POSTGRES:
        with get_connection() as connection:
            _init_postgres(connection)
        return

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as connection:
        _init_sqlite(connection)
