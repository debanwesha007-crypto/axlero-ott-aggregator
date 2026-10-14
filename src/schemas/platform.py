
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class PlatformCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=100,
    )
    website_url: HttpUrl | None = None


class PlatformResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    website_url: HttpUrl | None = None
    created_at: datetime
