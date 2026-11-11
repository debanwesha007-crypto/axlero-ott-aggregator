import httpx
from fastapi import HTTPException

from src.core.config import settings


WATCHMODE_BASE_URL = "https://api.watchmode.com/v1"


async def search_titles(query: str, limit: int = 10):
    """Search movies and TV shows using Watchmode API."""

    if not settings.watchmode_api_key:
        raise HTTPException(
            status_code=503,
            detail="Watchmode API key is not configured.",
        )

    params = {
        "apiKey": settings.watchmode_api_key,
        "search_field": "name",
        "search_value": query,
        "types": "movie,tv_series",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{WATCHMODE_BASE_URL}/search/",
                params=params,
            )
            response.raise_for_status()
            return response.json()

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Watchmode API returned status {exc.response.status_code}.",
        )

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to Watchmode API.",
        )


async def get_title_sources(title_id: int):
    """Get streaming sources for a Watchmode title."""

    if not settings.watchmode_api_key:
        raise HTTPException(
            status_code=503,
            detail="Watchmode API key is not configured.",
        )

    params = {
        "apiKey": settings.watchmode_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{WATCHMODE_BASE_URL}/title/{title_id}/sources/",
                params=params,
            )
            response.raise_for_status()
            return response.json()

    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Watchmode API returned status {exc.response.status_code}.",
        )

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to Watchmode API.",
        )
