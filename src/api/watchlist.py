from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.api.auth import get_current_user
from src.core.database import get_db
from src.models.content import Content
from src.models.user import User
from src.models.watchlist import Watchlist
from src.schemas.watchlist import (
    WatchlistContentResponse,
    WatchlistCreate,
    WatchlistResponse,
)

router = APIRouter(prefix="/api/watchlist", tags=["Watchlist"])


@router.post(
    "/",
    response_model=WatchlistResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_to_watchlist(
    payload: WatchlistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add content to the authenticated user's watchlist."""

    content = db.get(Content, payload.content_id)

    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found",
        )

    existing_item = db.scalar(
        select(Watchlist).where(
            Watchlist.user_id == current_user.id,
            Watchlist.content_id == payload.content_id,
        )
    )

    if existing_item is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Content is already in your watchlist",
        )

    item = Watchlist(
        user_id=current_user.id,
        content_id=payload.content_id,
    )

    try:
        db.add(item)
        db.commit()
        db.refresh(item)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Content is already in your watchlist",
        )

    return item


@router.get(
    "/",
    response_model=list[WatchlistContentResponse],
)
def get_watchlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's watchlist."""

    query = (
        select(Watchlist)
        .options(
            selectinload(Watchlist.content).selectinload(Content.platform)
        )
        .where(Watchlist.user_id == current_user.id)
        .order_by(Watchlist.created_at.desc())
    )

    items = db.scalars(query).all()

    return [
        WatchlistContentResponse(
            id=item.content.id,
            title=item.content.title,
            content_type=item.content.content_type,
            genre=item.content.genre,
            release_year=item.content.release_year,
            platform_name=(
                item.content.platform.name
                if item.content.platform
                else None
            ),
        )
        for item in items
    ]


@router.delete(
    "/{content_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_from_watchlist(
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove content from the authenticated user's watchlist."""

    item = db.scalar(
        select(Watchlist).where(
            Watchlist.user_id == current_user.id,
            Watchlist.content_id == content_id,
        )
    )

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist item not found",
        )

    db.delete(item)
    db.commit()
    return None