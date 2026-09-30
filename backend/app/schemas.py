from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


USERNAME_PATTERN = r"^[A-Za-z0-9_]{3,24}$"


def clean_required_text(value: str, label: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError(f"{label}不能为空")
    return value


def clean_tags(value: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw_tag in value:
        tag = raw_tag.strip().lstrip("#").lower()
        if not tag:
            continue
        if len(tag) > 20:
            raise ValueError("每个标签最多 20 个字符")
        if tag not in seen:
            seen.add(tag)
            cleaned.append(tag)
    if len(cleaned) > 5:
        raise ValueError("最多添加 5 个标签")
    return cleaned


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=USERNAME_PATTERN)
    display_name: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=6, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        return clean_required_text(value, "昵称")


class LoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        return value.strip().lower()


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    bio: str = ""
    role: Literal["admin", "member"]
    created_at: datetime


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=30)
    bio: str = Field(default="", max_length=160)

    @field_validator("display_name")
    @classmethod
    def clean_display_name(cls, value: str) -> str:
        return clean_required_text(value, "昵称")

    @field_validator("bio")
    @classmethod
    def clean_bio(cls, value: str) -> str:
        return value.strip()


class PostAuthorOut(BaseModel):
    id: int | None = None
    username: str | None = None
    display_name: str
    role: Literal["admin", "member", "guest"]
    is_legacy: bool = False


class PostBase(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        return clean_required_text(value, "帖子内容")

    @field_validator("tags")
    @classmethod
    def clean_tag_values(cls, value: list[str]) -> list[str]:
        return clean_tags(value)


class PostCreate(PostBase):
    pass


class PostUpdate(PostBase):
    pass


class PostOut(BaseModel):
    id: int
    content: str
    tags: list[str]
    author: PostAuthorOut
    created_at: datetime
    updated_at: datetime
    like_count: int
    comment_count: int
    liked_by_me: bool
    can_edit: bool
    can_delete: bool


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        return clean_required_text(value, "评论内容")


class CommentUpdate(CommentCreate):
    pass


class CommentOut(BaseModel):
    id: int
    post_id: int
    content: str
    author: PostAuthorOut
    created_at: datetime
    updated_at: datetime
    can_edit: bool
    can_delete: bool


class LikeOut(BaseModel):
    liked: bool
    like_count: int


class TagOut(BaseModel):
    name: str
    post_count: int


class ProfileOut(BaseModel):
    user: UserOut
    post_count: int
    received_like_count: int
    comment_count: int
    posts: list[PostOut]


class HealthOut(BaseModel):
    status: str
