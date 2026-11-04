
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.models.review import Review

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
    
def test_content_invalid_type_returns_400():
    token = get_test_token()

    response = client.get(
        "/api/content/?content_type=invalid",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400


def test_content_invalid_release_year_returns_422():
    token = get_test_token()

    response = client.get(
        "/api/content/?release_year=1800",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_content_invalid_platform_id_returns_422():
    token = get_test_token()

    response = client.get(
        "/api/content/?platform_id=0",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_content_invalid_pagination_returns_422():
    token = get_test_token()

    response = client.get(
        "/api/content/?skip=-1",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_nonexistent_content_returns_404():
    token = get_test_token()

    response = client.get(
        "/api/content/99999",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404

def test_watchlist_requires_authentication():
    response = client.get("/api/watchlist/")
    assert response.status_code == 401


def test_add_content_to_watchlist():
    token = get_test_token()
    create_test_content()

    response = client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["content_id"] == 1
    assert data["user_id"] == 1


def test_get_watchlist():
    token = get_test_token()
    create_test_content()

    add_response = client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert add_response.status_code == 201

    response = client.get(
        "/api/watchlist/",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Inception"
    assert data[0]["content_type"] == "movie"
    assert data[0]["platform_name"] == "Netflix"


def test_add_duplicate_content_to_watchlist():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    first_response = client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers=headers,
    )
    assert first_response.status_code == 201

    second_response = client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers=headers,
    )

    assert second_response.status_code == 409


def test_add_nonexistent_content_to_watchlist():
    token = get_test_token()

    response = client.post(
        "/api/watchlist/",
        json={"content_id": 99999},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_remove_content_from_watchlist():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    add_response = client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers=headers,
    )
    assert add_response.status_code == 201

    delete_response = client.delete(
        "/api/watchlist/1",
        headers=headers,
    )

    assert delete_response.status_code == 204

    list_response = client.get(
        "/api/watchlist/",
        headers=headers,
    )

    assert list_response.status_code == 200
    assert list_response.json() == []


def test_remove_nonexistent_watchlist_item():
    token = get_test_token()

    response = client.delete(
        "/api/watchlist/99999",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404

    # ---------------- Reviews API Tests ----------------


def test_reviews_require_authentication():
    response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 5,
            "review_text": "Excellent movie",
        },
    )
    assert response.status_code == 401


def test_create_review():
    token = get_test_token()
    create_test_content()

    response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 5,
            "review_text": "Excellent movie",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["content_id"] == 1
    assert data["rating"] == 5
    assert data["review_text"] == "Excellent movie"
    assert data["user_id"] == 1


@pytest.mark.parametrize("rating", [0, 6, -1])
def test_invalid_review_rating(rating):
    token = get_test_token()
    create_test_content()

    response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": rating,
            "review_text": "Invalid rating",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_duplicate_review_is_rejected():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "content_id": 1,
        "rating": 4,
        "review_text": "Good movie",
    }

    first_response = client.post(
        "/api/reviews/",
        json=payload,
        headers=headers,
    )
    assert first_response.status_code == 201

    second_response = client.post(
        "/api/reviews/",
        json=payload,
        headers=headers,
    )
    assert second_response.status_code == 409


def test_review_for_nonexistent_content_returns_404():
    token = get_test_token()

    response = client.post(
        "/api/reviews/",
        json={
            "content_id": 99999,
            "rating": 4,
            "review_text": "Not found",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_get_content_reviews():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 5,
            "review_text": "Amazing",
        },
        headers=headers,
    )
    assert create_response.status_code == 201

    response = client.get(
        "/api/reviews/content/1",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["rating"] == 5
    assert data[0]["review_text"] == "Amazing"


def test_get_my_reviews():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 4,
            "review_text": "Worth watching",
        },
        headers=headers,
    )
    assert create_response.status_code == 201

    response = client.get(
        "/api/reviews/my",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["content_id"] == 1
    assert data[0]["rating"] == 4


def test_update_own_review():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 3,
            "review_text": "It was okay",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    review_id = create_response.json()["id"]

    response = client.put(
        f"/api/reviews/{review_id}",
        json={
            "rating": 5,
            "review_text": "Actually, it was excellent",
        },
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["rating"] == 5
    assert response.json()["review_text"] == "Actually, it was excellent"


def test_delete_own_review():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 4,
            "review_text": "Good",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    review_id = create_response.json()["id"]

    delete_response = client.delete(
        f"/api/reviews/{review_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    list_response = client.get(
        "/api/reviews/my",
        headers=headers,
    )
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_user_cannot_update_another_users_review():
    first_token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {first_token}"}

    create_response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 4,
            "review_text": "Original review",
        },
        headers=headers,
    )
    assert create_response.status_code == 201
    review_id = create_response.json()["id"]

    # Create a second user directly in the test database.
    from src.models.user import User

    db = TestingSessionLocal()
    try:
        second_user = User(
            name="Second User",
            email="seconduser@example.com",
            password_hash=hash_password("SecondPass123"),
        )
        db.add(second_user)
        db.commit()
    finally:
        db.close()

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "seconduser@example.com",
            "password": "SecondPass123",
        },
    )
    assert login_response.status_code == 200
    second_token = login_response.json()["access_token"]

    update_response = client.put(
        f"/api/reviews/{review_id}",
        json={"rating": 1},
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert update_response.status_code == 404
# ---------------- Review Summary API Tests ----------------


def test_review_summary_with_multiple_reviews():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    # Create the first review.
    first_response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 5,
            "review_text": "Excellent",
        },
        headers=headers,
    )
    assert first_response.status_code == 201

    # Create another user so the second review is from a different user.
    from src.models.user import User

    db = TestingSessionLocal()
    try:
        second_user = User(
            name="Second User",
            email="seconduser@example.com",
            password_hash=hash_password("SecondPass123"),
        )
        db.add(second_user)
        db.commit()
    finally:
        db.close()

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "seconduser@example.com",
            "password": "SecondPass123",
        },
    )
    assert login_response.status_code == 200
    second_token = login_response.json()["access_token"]

    second_response = client.post(
        "/api/reviews/",
        json={
            "content_id": 1,
            "rating": 3,
            "review_text": "Good",
        },
        headers={"Authorization": f"Bearer {second_token}"},
    )
    assert second_response.status_code == 201

    response = client.get(
        "/api/reviews/content/1/summary",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()

    assert data["content_id"] == 1
    assert data["average_rating"] == 4.0
    assert data["total_reviews"] == 2
    assert data["rating_distribution"] == {
        "1": 0,
        "2": 0,
        "3": 1,
        "4": 0,
        "5": 1,
    }


def test_review_summary_without_reviews():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/reviews/content/1/summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["content_id"] == 1
    assert data["average_rating"] is None
    assert data["total_reviews"] == 0
    assert data["rating_distribution"] == {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
        "5": 0,
    }


def test_review_summary_for_nonexistent_content():
    token = get_test_token()

    response = client.get(
        "/api/reviews/content/99999/summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404


def test_review_summary_requires_authentication():
    create_test_content()

    response = client.get("/api/reviews/content/1/summary")

    assert response.status_code == 401

# ---------------- Recommendations API Tests ----------------


def test_recommendations_require_authentication():
    response = client.get("/api/recommendations/")
    assert response.status_code == 401


def test_recommendations_match_watchlist_genre():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    # Add Inception to the user's watchlist.
    watchlist_response = client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers=headers,
    )
    assert watchlist_response.status_code == 201

    response = client.get(
        "/api/recommendations/",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()

    # Interstellar has the same genre as Inception.
    recommended_ids = [item["id"] for item in data]
    assert 2 in recommended_ids
    assert 1 not in recommended_ids


def test_recommendations_exclude_watchlisted_content():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers=headers,
    )

    response = client.get(
        "/api/recommendations/",
        headers=headers,
    )

    assert response.status_code == 200
    recommended_ids = [item["id"] for item in response.json()]
    assert 1 not in recommended_ids


def test_recommendations_empty_watchlist_returns_empty_list():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/recommendations/",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json() == []


def test_recommendations_limit_is_respected():
    token = get_test_token()
    create_test_content()
    headers = {"Authorization": f"Bearer {token}"}

    # Inception and Interstellar share the Science Fiction genre.
    client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers=headers,
    )

    response = client.get(
        "/api/recommendations/?limit=1",
        headers=headers,
    )

    assert response.status_code == 200
    assert len(response.json()) <= 1
    # ---------------- Recommendation Rating Sorting Test ----------------

def test_recommendations_sort_by_average_rating():
    token = get_test_token()
    create_test_content()

    headers = {"Authorization": f"Bearer {token}"}

    # Add Inception (ID 1) to the watchlist.
    watchlist_response = client.post(
        "/api/watchlist/",
        json={"content_id": 1},
        headers=headers,
    )
    assert watchlist_response.status_code == 201

    # Give Interstellar (ID 2) a 3-star rating.
    review_response = client.post(
        "/api/reviews/",
        json={
            "content_id": 2,
            "rating": 3,
            "review_text": "Good movie",
        },
        headers=headers,
    )
    assert review_response.status_code == 201

    # Create another user so the same content can receive
    # a second review without violating the unique constraint.
    from src.models.user import User

    db = TestingSessionLocal()
    try:
        second_user = User(
    name="Second Test User",
    email="second-test@example.com",
    password_hash=hash_password("TestPassword123!"),
)
        db.add(second_user)
        db.commit()
        db.refresh(second_user)

        db.add(
            Review(
                user_id=second_user.id,
                content_id=2,
                rating=5,
                review_text="Excellent movie",
            )
        )
        db.commit()
    finally:
        db.close()

    # Get recommendations.
    response = client.get(
        "/api/recommendations/",
        headers=headers,
    )

    assert response.status_code == 200

    recommendations = response.json()
    assert len(recommendations) == 1
    assert recommendations[0]["id"] == 2
    assert recommendations[0]["average_rating"] == 4.0
    assert recommendations[0]["review_count"] == 2
    # ---------------- Content Sorting Tests ----------------


def test_content_sort_by_title_ascending():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?sort_by=title&sort_order=asc",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert titles == ["Inception", "Interstellar", "The Office"]


def test_content_sort_by_title_descending():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?sort_by=title&sort_order=desc",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert titles == ["The Office", "Interstellar", "Inception"]


def test_content_sort_by_release_year_ascending():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?sort_by=release_year&sort_order=asc",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    years = [item["release_year"] for item in response.json()]
    assert years == [2005, 2010, 2014]


def test_content_sort_by_release_year_descending():
    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/?sort_by=release_year&sort_order=desc",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    years = [item["release_year"] for item in response.json()]
    assert years == [2014, 2010, 2005]


def test_content_sort_invalid_sort_by_returns_422():
    token = get_test_token()

    response = client.get(
        "/api/content/?sort_by=invalid",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_content_sort_invalid_sort_order_returns_422():
    token = get_test_token()

    response = client.get(
        "/api/content/?sort_order=invalid",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_content_default_sort_is_newest_first(monkeypatch):
    import src.api.content as content_api

    # Disable Redis cache for this test to keep it deterministic.
    monkeypatch.setattr(content_api, "get_redis", lambda: None)

    token = get_test_token()
    create_test_content()

    response = client.get(
        "/api/content/",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    titles = [item["title"] for item in response.json()]
    assert titles == ["The Office", "Interstellar", "Inception"]