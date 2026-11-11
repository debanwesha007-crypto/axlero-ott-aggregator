
from fastapi import APIRouter, Query

from src.services.watchmode import search_titles, get_title_sources

router = APIRouter(
    prefix="/api/watchmode",
    tags=["Watchmode"],
)

@router.get("/search")
async def search_watchmode_titles(
    query: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(10, ge=1, le=20),
):
    return await search_titles(query=query, limit=limit)


@router.get("/title/{title_id}/sources")
async def get_watchmode_sources(title_id: int):
    return await get_title_sources(title_id=title_id)