from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_home():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health_check():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_content_list():
    response = client.get("/api/content/?skip=0&limit=1")

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) <= 1
