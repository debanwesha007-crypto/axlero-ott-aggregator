from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ContentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    content_type: Literal["movie", "tv_show"]
    release_year: int | None = Field(default=None, ge=1888, le=2100)
    genre: str | None = Field(default=None, max_length=100)
    poster_url: HttpUrl | None = None


class ContentResponse(BaseModel):
    id: int
    title: str
    description: str | None
    content_type: str
    release_year: int | None
    genre: str | None
    poster_url: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)