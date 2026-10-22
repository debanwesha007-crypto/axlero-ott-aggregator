
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.core.cache import get_redis
from src.core.database import get_db
from src.api.auth import get_current_user
from src.models.content import Content
from src.models.platform import Platform
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

    except Exception as exc:
        print(f"Cache invalidation failed: {exc}")


def serialize_content(content: Content) -> dict:
    """Serialize content including its OTT platform name."""
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


@router.post(
    "/",
    response_model=ContentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_content(
    payload: ContentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    # Check that the selected platform exists.
    platform = None

    if payload.platform_id is not None:
        platform = db.get(Platform, payload.platform_id)

        if platform is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="OTT platform not found",
            )

    content = Content(
        title=payload.title,
        description=payload.description,
        content_type=payload.content_type,
        platform_id=payload.platform_id,
        release_year=payload.release_year,
        genre=payload.genre,
        poster_url=(
            str(payload.poster_url)
            if payload.poster_url
            else None
        ),
    )

    db.add(content)
    db.commit()
    db.refresh(content)

    # Explicitly load the related platform.
    if content.platform_id is not None:
        content = db.scalars(
            select(Content)
            .options(selectinload(Content.platform))
            .where(Content.id == content.id)
        ).one()

    invalidate_content_list_cache()

    return serialize_content(content)


@router.get("/", response_model=list[ContentResponse])
def list_content(
    title: str | None = None,
    content_type: str | None = None,
    genre: str | None = None,
    release_year: int | None = None,
    platform_id: int | None = Query(default=None, ge=1),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
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
        f"platform_id={platform_id}:"
        f"skip={skip}:"
        f"limit={limit}"
    )

    redis_client = get_redis()

    # Try Redis cache first.
    try:
        cached_data = redis_client.get(cache_key)

        if cached_data is not None:
            print("CACHE HIT")
            return json.loads(cached_data)

    except Exception as exc:
        print(f"Cache read failed: {exc}")

    print("CACHE MISS")

    query = (
        select(Content)
        .options(selectinload(Content.platform))
    )

    if title:
        query = query.where(Content.title.ilike(f"%{title}%"))

    if content_type:
        query = query.where(Content.content_type == content_type)

    if genre:
        query = query.where(Content.genre.ilike(f"%{genre}%"))

    if release_year is not None:
        query = query.where(Content.release_year == release_year)

    if platform_id is not None:
        query = query.where(Content.platform_id == platform_id)

    items = db.scalars(
        query.order_by(Content.id.desc())
        .offset(skip)
        .limit(limit)
    ).all()

    # Temporary debug output to inspect loaded relationships.
   
    result = [serialize_content(item) for item in items]

    # Cache the response for 60 seconds.
    try:
               redis_client.set(
            cache_key,
            json.dumps(result),
            ex=CACHE_TTL,
        )

    except Exception as exc:
        print(f"Cache write failed: {exc}")

    return result


@router.get("/{content_id}", response_model=ContentResponse)
def get_content(
    content_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
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
