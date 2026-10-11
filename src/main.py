from fastapi import FastAPI
from src.api.content import router as content_router
from src.api.users import router as users_router
from src.api.auth import router as auth_router

app = FastAPI(
    title="OTT Content Aggregator API",
    description="Discover and search movies and TV shows.",
    version="0.1.0",
)

app.include_router(users_router)
app.include_router(auth_router)
app.include_router(content_router)

@app.get("/")
def home():
    return {
        "message": "Welcome to OTT Content Aggregator API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}