import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.core.cache import get_redis
from src.core.database import get_db
from src.api.auth import get_current_user
from src.models.content import Content
from src.models.platform import Platform


router = APIRouter(prefix="/api/content", tags=["Content"])

CACHE_TTL = 60
CONTENT_LIST_CACHE_PREFIX = "content:list:"

logger = logging.getLogger(__name__)


def invalidate_content_list_cache():
    """Invalidate cached content-list responses after content changes."""
    try:
        redis_client = get_redis()

        if redis_client is None:
            return

        keys = redis_client.scan_iter(
            match=f"{CONTENT_LIST_CACHE_PREFIX}*"
        )

        for key in keys:
            redis_client.delete(key)

    except Exception:
        logger.exception("Content-list cache invalidation failed")


def serialize_content(content: Content) -> dict:
    """Convert a Content model into a JSON-serializable dictionary."""
    return {
        "id": content.id,
        "title": content.title,
        "description": content.description,
        "content_type": content.content_type,
        "platform_id": content.platform_id,
        "platform_name": (
            content.platform.name if content.platform else None
        ),
        "release_year": content.release_year,
        "genre": content.genre,
        "poster_url": content.poster_url,
        "created_at": (
            content.created_at.isoformat()
            if content.created_at
            else None
        ),
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_content(
    content_data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create content and invalidate cached content-list responses."""
    platform_id = content_data.get("platform_id")

    if platform_id is not None:
        platform = db.get(Platform, platform_id)

        if platform is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Platform not found",
            )

    try:
        content = Content(**content_data)
        db.add(content)
        db.commit()
        db.refresh(content)

        # Reload platform information for the response.
        if content.platform_id is not None:
            db.refresh(content)

        invalidate_content_list_cache()

        return serialize_content(content)

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create content")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create content",
        ) from exc


@router.get("/")
def list_content(
    title: str | None = None,
    content_type: str | None = None,
    genre: str | None = None,
    release_year: int | None = Query(
        default=None,
        ge=1888,
        le=2100,
    ),
    platform_id: int | None = Query(
        default=None,
        ge=1,
    ),
    skip: int = Query(
        default=0,
        ge=0,
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    sort_by: str = Query(
        default="id",
        pattern="^(id|title|release_year)$",
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Search, filter, sort, paginate, and cache content."""
    if content_type is not None and content_type not in {
        "movie",
        "tv_show",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content_type must be 'movie' or 'tv_show'",
        )

    # Include every filter and sorting option in the cache key.
    cache_key = (
        f"{CONTENT_LIST_CACHE_PREFIX}"
        f"title={title}:"
        f"type={content_type}:"
        f"genre={genre}:"
        f"year={release_year}:"
        f"platform_id={platform_id}:"
        f"skip={skip}:"
        f"limit={limit}:"
        f"sort_by={sort_by}:"
        f"sort_order={sort_order}"
    )

    # Try Redis cache first.
    try:
        redis_client = get_redis()

        if redis_client is not None:
            cached_data = redis_client.get(cache_key)

            if cached_data:
                if isinstance(cached_data, bytes):
                    cached_data = cached_data.decode("utf-8")

                return json.loads(cached_data)

    except Exception:
        logger.exception("Content-list cache read failed")

    # Build the database query.
    query = select(Content).options(
        selectinload(Content.platform)
    )

    if title:
        query = query.where(
            Content.title.ilike(f"%{title}%")
        )

    if content_type:
        query = query.where(
            Content.content_type == content_type
        )

    if genre:
        query = query.where(
            Content.genre.ilike(f"%{genre}%")
        )

    if release_year is not None:
        query = query.where(
            Content.release_year == release_year
        )

    if platform_id is not None:
        query = query.where(
            Content.platform_id == platform_id
        )

    # Map allowed sort fields to database columns.
    sort_columns = {
        "id": Content.id,
        "title": Content.title,
        "release_year": Content.release_year,
    }

    sort_column = sort_columns[sort_by]

    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    # Use ID as a deterministic tie-breaker for other sort fields.
    if sort_by != "id":
        query = query.order_by(Content.id.desc())

    # Apply pagination after filtering and sorting.
    query = query.offset(skip).limit(limit)

    content_items = db.scalars(query).all()

    result = [
        serialize_content(content)
        for content in content_items
    ]

    # Cache the response for the configured TTL.
    try:
        redis_client = get_redis()

        if redis_client is not None:
            redis_client.set(
                cache_key,
                json.dumps(result),
                ex=CACHE_TTL,
            )

    except Exception:
        logger.exception("Content-list cache write failed")

    return result


@router.get("/{content_id}")
def get_content(
    content_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retrieve a single content item by ID."""
    query = (
        select(Content)
        .options(selectinload(Content.platform))
        .where(Content.id == content_id)
    )

    content = db.scalars(query).first()

    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found",
        )

    return serialize_content(content)