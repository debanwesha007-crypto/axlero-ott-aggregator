from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from src.api.auth import get_current_user
from src.core.database import get_db
from src.models.content import Content
from src.models.review import Review
from src.models.user import User
from src.models.watchlist import Watchlist


router = APIRouter(
    prefix="/api/recommendations",
    tags=["Recommendations"],
)


@router.get("/")
def get_recommendations(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recommend content based on genres in the user's watchlist."""

    # Find the content IDs already in the user's watchlist.
    watchlist_query = select(
        Watchlist.content_id
    ).where(
        Watchlist.user_id == current_user.id
    )

    watched_content_ids = set(db.scalars(watchlist_query).all())

    if not watched_content_ids:
        return []

    # Collect genres from the user's existing watchlist.
    genre_query = select(Content.genre).join(
        Watchlist,
        Watchlist.content_id == Content.id,
    ).where(
        Watchlist.user_id == current_user.id,
        Content.genre.is_not(None),
    )

    genres = {
        genre.strip()
        for genre in db.scalars(genre_query).all()
        if genre and genre.strip()
    }

    if not genres:
        return []

    # Calculate the average rating and review count for each content item.
    rating_subquery = (
        select(
            Review.content_id.label("content_id"),
            func.avg(Review.rating).label("average_rating"),
            func.count(Review.id).label("review_count"),
        )
        .group_by(Review.content_id)
        .subquery()
    )

    # Recommend other content whose genre matches the watchlist genres.
    query = (
        select(
            Content,
            func.coalesce(
                rating_subquery.c.average_rating,
                0.0,
            ).label("average_rating"),
            func.coalesce(
                rating_subquery.c.review_count,
                0,
            ).label("review_count"),
        )
        .outerjoin(
            rating_subquery,
            rating_subquery.c.content_id == Content.id,
        )
        .options(selectinload(Content.platform))
        .where(
            Content.genre.in_(genres),
            Content.id.not_in(watched_content_ids),
        )
        .order_by(
            func.coalesce(
                rating_subquery.c.average_rating,
                0.0,
            ).desc(),
            func.coalesce(
                rating_subquery.c.review_count,
                0,
            ).desc(),
            Content.title.asc(),
        )
        .limit(max(1, min(limit, 50)))
    )

    results = db.execute(query).all()

    return [
        {
            "id": content.id,
            "title": content.title,
            "description": content.description,
            "content_type": content.content_type,
            "platform_id": content.platform_id,
            "platform_name": (
                content.platform.name
                if content.platform
                else None
            ),
            "release_year": content.release_year,
            "genre": content.genre,
            "poster_url": content.poster_url,
            "created_at": (
                content.created_at.isoformat()
                if content.created_at
                else None
            ),
            "average_rating": (
                float(average_rating)
                if average_rating is not None
                else 0.0
            ),
            "review_count": int(review_count),
        }
        for content, average_rating, review_count in results
    ]
