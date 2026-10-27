from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.api.auth import get_current_user
from src.core.database import get_db
from src.models.content import Content
from src.models.review import Review
from src.models.user import User
from src.schemas.review import ReviewCreate, ReviewResponse, ReviewUpdate

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.post(
    "/",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a review for content."""

    content = db.get(Content, payload.content_id)

    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found",
        )

    existing_review = db.scalar(
        select(Review).where(
            Review.user_id == current_user.id,
            Review.content_id == payload.content_id,
        )
    )

    if existing_review is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this content",
        )

    review = Review(
        user_id=current_user.id,
        content_id=payload.content_id,
        rating=payload.rating,
        review_text=payload.review_text,
    )

    try:
        db.add(review)
        db.commit()
        db.refresh(review)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this content",
        )

    return review


@router.get(
    "/my",
    response_model=list[ReviewResponse],
)
def get_my_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return reviews created by the authenticated user."""

    query = (
        select(Review)
        .where(Review.user_id == current_user.id)
        .order_by(Review.created_at.desc())
    )

    return db.scalars(query).all()


@router.get(
    "/content/{content_id}",
    response_model=list[ReviewResponse],
)
def get_content_reviews(
    content_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all reviews for a content item."""

    content = db.get(Content, content_id)

    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found",
        )

    query = (
        select(Review)
        .where(Review.content_id == content_id)
        .order_by(Review.created_at.desc())
    )

    return db.scalars(query).all()


@router.put(
    "/{review_id}",
    response_model=ReviewResponse,
)
def update_review(
    review_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the authenticated user's own review."""

    review = db.get(Review, review_id)

    if review is None or review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one field to update",
        )

    for field, value in updates.items():
        setattr(review, field, value)

    try:
        db.commit()
        db.refresh(review)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid review data",
        )

    return review


@router.delete(
    "/{review_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete the authenticated user's own review."""

    review = db.get(Review, review_id)

    if review is None or review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found",
        )

    db.delete(review)
    db.commit()

    return None