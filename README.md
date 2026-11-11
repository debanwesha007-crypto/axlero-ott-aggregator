# Axlero OTT Aggregator

Axlero OTT Aggregator is a web-based application that helps users discover and explore movies and TV shows across OTT platforms.

## Features

- User registration and JWT-based authentication
- Browse movies and TV shows
- Search content by title
- Filter by genre, release year, and OTT platform
- View OTT platform information
- Add and remove titles from personal watchlists
- Submit and manage reviews and ratings
- View review summaries
- Get content recommendations based on watchlist preferences
- Redis caching support
- REST API documentation using Swagger UI

## Technology Stack

**Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL, Redis

**Frontend:** React, Vite, JavaScript, CSS

**Authentication:** JWT

**Testing:** Pytest, HTTPX

## Project Structure

```text
axlero-ott-aggregator/
├── frontend/
├── src/
│   ├── api/
│   ├── core/
│   ├── models/
│   ├── schemas/
│   └── main.py
├── tests/
├── .env.example
├── requirements.txt
└── README.md
```

## Prerequisites

- Python 3.12 or later
- Node.js and npm
- PostgreSQL
- Redis
- Git

## Backend Setup

1. Clone the repository:

```bash
git clone https://github.com/debanwesha007-crypto/axlero-ott-aggregator.git
cd axlero-ott-aggregator
```

2. Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Configure environment variables:

```bash
cp .env.example .env
```

Update `.env` with your own database credentials, secret key, and Redis connection details. Never commit the actual `.env` file.

5. Start the backend:

```bash
uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

Backend: http://127.0.0.1:8000

Swagger API documentation: http://127.0.0.1:8000/docs

Health check: http://127.0.0.1:8000/health

## Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL provided by Vite, usually http://localhost:5173.

## Running Tests

From the project root:

```bash
pytest -q
```

## Production Build

From the frontend directory:

```bash
npm run build
```

The production build is generated in `frontend/dist`.

## Project Scope

The application focuses on OTT content discovery, aggregation, and user engagement. It does not directly host or stream movies or TV shows. Content availability depends on the data stored in the application.

## Team

Developed as an internship project by a two-member team.

---

**Axlero OTT Aggregator**
