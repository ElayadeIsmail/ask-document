from fastapi.testclient import TestClient

from app.main import app


def test_root_and_health():
    with TestClient(app) as client:
        root = client.get("/")
        assert root.status_code == 200
        assert root.json()["name"] == "AskDoc"

        health = client.get("/api/v1/health")
        assert health.status_code == 200
        body = health.json()
        assert body["status"] == "ok"
        assert "embedding" in body["models"]
