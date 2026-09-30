import argparse
import os
import sqlite3
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "data" / "app.db"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy the local SQLite community data into PostgreSQL."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Path to the source SQLite database.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing target rows before copying.",
    )
    return parser.parse_args()


def rows(connection: sqlite3.Connection, query: str):
    connection.row_factory = sqlite3.Row
    return [dict(row) for row in connection.execute(query).fetchall()]


def main() -> None:
    args = parse_args()
    database_url = os.environ.get("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    if not args.source.exists():
        raise SystemExit(f"SQLite database not found: {args.source}")

    source = sqlite3.connect(args.source)

    with psycopg.connect(database_url) as target:
        if args.replace:
            target.execute(
                """
                TRUNCATE post_tags, post_likes, comments, posts, tags, auth_sessions, users
                RESTART IDENTITY CASCADE
                """
            )

        user_rows = rows(
            source,
            "SELECT id, username, display_name, bio, password_hash, role, created_at FROM users",
        )
        for row in user_rows:
            target.execute(
                """
                INSERT INTO users (
                    id, username, display_name, bio, password_hash, role, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    row["id"],
                    row["username"],
                    row["display_name"],
                    row.get("bio", ""),
                    row["password_hash"],
                    row["role"],
                    row["created_at"],
                ),
            )

        post_rows = rows(
            source,
            "SELECT id, user_id, author_name, content, created_at, updated_at FROM posts",
        )
        for row in post_rows:
            target.execute(
                """
                INSERT INTO posts (
                    id, user_id, author_name, content, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    row["id"],
                    row["user_id"],
                    row["author_name"],
                    row["content"],
                    row["created_at"],
                    row["updated_at"],
                ),
            )

        comment_rows = rows(
            source,
            """
            SELECT id, post_id, user_id, content, created_at, updated_at
            FROM comments
            """,
        )
        for row in comment_rows:
            target.execute(
                """
                INSERT INTO comments (
                    id, post_id, user_id, content, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    row["id"],
                    row["post_id"],
                    row["user_id"],
                    row["content"],
                    row["created_at"],
                    row["updated_at"],
                ),
            )

        tag_rows = rows(source, "SELECT id, name, created_at FROM tags")
        for row in tag_rows:
            target.execute(
                """
                INSERT INTO tags (id, name, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (row["id"], row["name"], row["created_at"]),
            )

        for row in rows(source, "SELECT post_id, tag_id FROM post_tags"):
            target.execute(
                """
                INSERT INTO post_tags (post_id, tag_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (row["post_id"], row["tag_id"]),
            )

        for row in rows(
            source,
            "SELECT post_id, user_id, created_at FROM post_likes",
        ):
            target.execute(
                """
                INSERT INTO post_likes (post_id, user_id, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (row["post_id"], row["user_id"], row["created_at"]),
            )

        for table in ("users", "posts", "comments", "tags"):
            target.execute(
                """
                SELECT setval(
                    pg_get_serial_sequence(%s, 'id'),
                    COALESCE((SELECT MAX(id) FROM """ + table + """), 1),
                    (SELECT COUNT(*) > 0 FROM """ + table + """)
                )
                """,
                (table,),
            )

    source.close()
    print(
        f"Migrated {len(user_rows)} users, {len(post_rows)} posts, "
        f"{len(comment_rows)} comments and {len(tag_rows)} tags."
    )


if __name__ == "__main__":
    main()
