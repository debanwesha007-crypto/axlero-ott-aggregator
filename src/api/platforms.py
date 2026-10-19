from src.api.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.models.platform import Platform
from src.schemas.platform import PlatformCreate, PlatformResponse

router = APIRouter(
    prefix="/api/platforms",
    tags=["Platforms"],
)


@router.post("/", response_model=PlatformResponse, status_code=201)
def create_platform(
    platform_data: PlatformCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    existing_platform = (
        db.query(Platform)
        .filter(Platform.name == platform_data.name)
        .first()
    )

    if existing_platform:
        raise HTTPException(
            status_code=409,
            detail="Platform already exists",
        )

    platform = Platform(
        name=platform_data.name,
        website_url=(
            str(platform_data.website_url)
            if platform_data.website_url
            else None
        ),
    )

    db.add(platform)
    db.commit()
    db.refresh(platform)

    return platform


@router.get("/", response_model=list[PlatformResponse])
def get_platforms(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(Platform)
        .offset(skip)
        .limit(min(limit, 100))
        .all()
    )
