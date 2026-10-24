
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app
from src.core.database import Base, get_db
from src.core.security import hash_password


TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    bind=test_engine,
    autoflush=False,
    autocommit=False,
)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_test_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


client = TestClient(app)


def create_test_user():
    from src.models.user import User

    db = TestingSessionLocal()
    try:
        user = User(
            name="Test User",
            email="testuser@example.com",
            password_hash=hash_password("TestPass123"),
        )
        db.add(user)
        db.commit()
    finally:
        db.close()


def get_test_token():
    create_test_user()

    response = client.post(
        "/api/auth/login",
        json={
            "email": "testuser@example.com",
            "password": "TestPass123",
        },
    )

    assert response.status_code == 200
    return response.json()["access_token"]


def test_home():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_content_list_requires_authentication():
    response = client.get("/api/content/?skip=0&limit=1")
    assert response.status_code == 401


def test_platform_list_requires_authentication():
    response = client.get("/api/platforms/")
    assert response.status_code == 401


def test_auth_me_rejects_invalid_token():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_auth_me_with_valid_token():
    token = get_test_token()

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "testuser@example.com"


def test_platform_list_with_valid_token():
    token = get_test_token()

    response = client.get(
        "/api/platforms/",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_content_list_with_valid_token():
    token = get_test_token()

    response = client.get(
        "/api/content/?skip=0&limit=1",
        headers={"Authorization": f"Bearer {token}"},
    )

def create_test_content():
    from src.models.content import Content
    from src.models.platform import Platform

    db = TestingSessionLocal()
    try:
        platform = Platform(
            name="Netflix",
            website_url="https://www.netflix.com/",
        )
        db.add(platform)
        db.flush()

        content_items = [
            Content(
                title="Inception",
                description="A science fiction thriller",
                content_type="movie",
                platform_id=platform.id,
                release_year=2010,
                genre="Science Fiction",
                poster_url="https://example.com/inception.jpg",
            ),
            Content(
                title="Interstellar",
                description="A space exploration movie",
                content_type="movie",
                platform_id=platform.id,
                release_year=2014,
                genre="Science Fiction",
                poster_url="https://example.com/interstellar.jpg",
            ),
            Content(
                title="The Office",
                description="A workplace comedy",
                content_type="tv_show",
                platform_id=platform.id,
                release_year=2005,
                genre="Comedy",
                poster_url="https://example.com/office.jpg",
            ),
        ]

        db.add_all(content_items)
        db.commit()
    finally:
        db.close()


def test_content_search_by_title():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?title=inception",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Inception"


def test_content_filter_by_genre():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?genre=Science%20Fiction",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert all(item["genre"] == "Science Fiction" for item in data)


def test_content_filter_by_release_year():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?release_year=2010",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Inception"


def test_content_filter_by_platform():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?platform_id=1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert all(item["platform_id"] == 1 for item in data)


    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_content_pagination():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?skip=0&limit=2",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_content_pagination_skip():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?skip=2&limit=2",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1

