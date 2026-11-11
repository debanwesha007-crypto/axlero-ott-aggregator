# Axlero OTT Aggregator

Axlero OTT Aggregator is a web-based application that helps users discover and explore movies and TV shows across OTT platforms.

## Features

- User registration and JWT-based authentication
- Browse movies and TV shows
- Search content by title
- Filter content by genre, release year, and OTT platform
- View OTT platform information
- Add and remove titles from personal watchlists
- Submit and manage reviews and ratings
- View review summaries
- Get content recommendations based on watchlist preferences
- Redis caching support
- REST API documentation using Swagger UI
- Check real-time streaming availability using Watchmode
- View subscription, rental, and purchase options for India

## Technology Stack

**Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL, Redis

**Frontend:** React, Vite, JavaScript, CSS

**Database Migrations:** Alembic

**Authentication:** JWT

**Testing:** Pytest, HTTPX

**External API:** Watchmode API

## Project Structure

```text
axlero-ott-aggregator/
├── alembic/
│   └── versions/
├── frontend/
│   ├── src/
│   └── package.json
├── src/
│   ├── api/
│   ├── core/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── main.py
├── tests/
├── alembic.ini
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
- Watchmode API key

## Backend Setup

### 1. Clone the repository

```bash
git clone https://github.com/debanwesha007-crypto/axlero-ott-aggregator.git
cd axlero-ott-aggregator
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Update `.env` with your own:

- PostgreSQL database URL
- JWT secret key
- Redis connection URL
- Watchmode API key

Obtain your API key from [Watchmode](https://www.watchmode.com/).

Never commit your actual `.env` file or API keys to GitHub.

### 5. Set up database migrations

Create your PostgreSQL database and ensure PostgreSQL is running.

Apply the database migrations:

```bash
alembic upgrade head
```

Alembic manages database schema changes and creates the required tables.

For future schema changes:

```bash
alembic revision --autogenerate -m "describe your changes"
alembic upgrade head
```

### 6. Start the backend

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

Open the local URL provided by Vite, usually:

http://localhost:5173

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

The application focuses on OTT content discovery, aggregation, and user engagement. It does not directly host or stream movies or TV shows.

Streaming availability is retrieved through the Watchmode API and filtered for India. Availability and pricing may change depending on region and provider.

## Data Attribution

Streaming availability data is powered by [Watchmode](https://www.watchmode.com/).

Availability information may be incomplete or change over time.

## Team

Developed as an internship project by a two-member team.

- Yash Hon
- Anwesha Deb

**Axlero OTT Aggregator**