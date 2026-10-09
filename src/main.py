from fastapi import FastAPI

app = FastAPI(
    title="OTT Content Aggregator API",
    description="Discover and search movies and TV shows.",
    version="0.1.0",
)


@app.get("/")
def home():
    return {
        "message": "Welcome to OTT Content Aggregator API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
