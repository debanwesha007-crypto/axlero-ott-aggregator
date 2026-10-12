from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.content import Content
from src.schemas.content import ContentCreate, ContentResponse


router = APIRouter(prefix="/api/content", tags=["Content"])


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
    query = select(Content)

    if title:
        query = query.where(Content.title.ilike(f"%{title}%"))

    if content_type:
        if content_type not in ("movie", "tv_show"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="content_type must be 'movie' or 'tv_show'",
            )
        query = query.where(Content.content_type == content_type)

    if genre:
        query = query.where(Content.genre.ilike(f"%{genre}%"))

    if release_year:
        query = query.where(Content.release_year == release_year)

    return db.scalars(
        query.order_by(Content.id.desc())
        .offset(skip)
        .limit(limit)
    ).all()

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
