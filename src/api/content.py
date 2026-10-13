import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.cache import get_redis
from src.core.database import get_db
from src.models.content import Content
from src.schemas.content import ContentCreate, ContentResponse


router = APIRouter(prefix="/api/content", tags=["Content"])

CACHE_TTL = 60
CONTENT_LIST_CACHE_PREFIX = "content:list:"


def invalidate_content_list_cache() -> None:
    """Remove cached content-list responses."""
    redis_client = get_redis()

    try:
        keys = redis_client.scan_iter(
            match=f"{CONTENT_LIST_CACHE_PREFIX}*",
            count=100,
        )

        for key in keys:
            redis_client.delete(key)

    except Exception:
        # Keep the API usable if the cache is unavailable.
        pass


@router.post(
    "/",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_content(
    payload: ContentCreate,
    db: Session = Depends(get_db),
):
    content = Content(
        title=payload.title,
        description=payload.description,
        content_type=payload.content_type,
        release_year=payload.release_year,
        genre=payload.genre,
        poster_url=str(payload.poster_url) if payload.poster_url else None,
    )

    db.add(content)
    db.commit()
    db.refresh(content)

    # Newly created content may change cached listing results.
    invalidate_content_list_cache()

    return content


@router.get("/", response_model=list[ContentResponse])
def list_content(
    title: str | None = None,
    content_type: str | None = None,
    genre: str | None = None,
    release_year: int | None = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if content_type and content_type not in ("movie", "tv_show"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content_type must be 'movie' or 'tv_show'",
        )

    cache_key = (
        f"{CONTENT_LIST_CACHE_PREFIX}"
        f"title={title}:"
        f"type={content_type}:"
        f"genre={genre}:"
        f"year={release_year}:"
        f"skip={skip}:"
        f"limit={limit}"
    )

    redis_client = get_redis()

   
    # 1. Try cache first.
    try:
        cached_data = redis_client.get(cache_key)

        if cached_data is not None:
            print("CACHE HIT")
            return json.loads(cached_data)

    except Exception:
        # Continue with PostgreSQL if the cache is unavailable.
        pass

    # 2. Cache miss: query PostgreSQL.
    print("CACHE MISS")
    query = select(Content)


    if title:
        query = query.where(Content.title.ilike(f"%{title}%"))

    if content_type:
        query = query.where(Content.content_type == content_type)

    if genre:
        query = query.where(Content.genre.ilike(f"%{genre}%"))

    if release_year:
        query = query.where(Content.release_year == release_year)

    items = db.scalars(
        query.order_by(Content.id.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    # Convert SQLAlchemy objects into JSON-compatible dictionaries.
    result = [
        ContentResponse.model_validate(item).model_dump(mode="json")
        for item in items
    ]

    # 3. Store the result for 60 seconds.
    try:
        redis_client.setex(
            cache_key,
            CACHE_TTL,
            json.dumps(result),
        )

    except Exception:
        # Return database results even if caching fails.
        pass

    return result


@router.get("/{content_id}", response_model=ContentResponse)
def get_content(
    content_id: int,
    db: Session = Depends(get_db),
):
    content = db.get(Content, content_id)

    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found",
        )

    return content
