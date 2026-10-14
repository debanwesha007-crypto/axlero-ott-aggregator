
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.database import Base
from src.models.platform import Platform


class Content(Base):
    __tablename__ = "contents"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    content_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )

    platform_id: Mapped[int | None] = mapped_column(
        ForeignKey("platforms.id"),
        nullable=True,
        index=True,
    )

    platform: Mapped[Platform | None] = relationship()

    release_year: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    genre: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    poster_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
