from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WatchlistCreate(BaseModel):
    content_id: int


class WatchlistContentResponse(BaseModel):
    id: int
    title: str
    content_type: str
    genre: str | None = None
    release_year: int | None = None
    platform_name: str | None = None


class WatchlistResponse(BaseModel):
    id: int
    user_id: int
    content_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)