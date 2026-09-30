import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
import sqlite3

from fastapi import HTTPException, Request, Response, status

from .database import get_connection
from .schemas import UserOut


SESSION_COOKIE = "community_session"
SESSION_TTL_DAYS = 30
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 64
COOKIE_SECURE = os.environ.get("APP_COOKIE_SECURE", "").lower() == "true"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_encode(salt)}${_encode(derived)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, n, r, p, salt, expected = encoded.split("$", 5)
        if scheme != "scrypt":
            return False
        derived = hashlib.scrypt(
            password.encode("utf-8"),
            salt=_decode(salt),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(_decode(expected)),
        )
        return hmac.compare_digest(_encode(derived), expected)
    except (ValueError, TypeError):
        return False


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(connection: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    created_at = utc_now()
    expires_at = created_at + timedelta(days=SESSION_TTL_DAYS)
    connection.execute("DELETE FROM auth_sessions WHERE expires_at <= ?", (created_at.isoformat(),))
    connection.execute(
        """
        INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (_token_digest(token), user_id, created_at.isoformat(), expires_at.isoformat()),
    )
    return token


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def _user_from_row(row: sqlite3.Row) -> UserOut:
    return UserOut(
        id=row["id"],
        username=row["username"],
        display_name=row["display_name"],
        bio=row["bio"],
        role=row["role"],
        created_at=datetime.fromisoformat(row["created_at"]),
    )


def get_optional_user(request: Request) -> UserOut | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT u.id, u.username, u.display_name, u.bio, u.role, u.created_at
            FROM auth_sessions AS s
            JOIN users AS u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
            """,
            (_token_digest(token), utc_now_iso()),
        ).fetchone()

    return _user_from_row(row) if row else None


def require_user(request: Request) -> UserOut:
    user = get_optional_user(request)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
        )
    return user


def can_manage(owner_id: int | None, user: UserOut | None) -> bool:
    return bool(user and (user.role == "admin" or owner_id == user.id))


def delete_session(token: str) -> None:
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM auth_sessions WHERE token_hash = ?",
            (_token_digest(token),),
        )



