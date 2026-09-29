from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class MessageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    content: str = Field(min_length=1, max_length=500)

    @field_validator("name", "content")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("内容不能为空")
        return value


class MessageOut(BaseModel):
    id: int
    name: str
    content: str
    created_at: datetime


class HealthOut(BaseModel):
    status: str
