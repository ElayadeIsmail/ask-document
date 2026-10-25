from fastapi.testclient import TestClient

from app.main import app


def test_create_and_list_collection():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/collections",
            json={"name": "PFE Demo", "description": "Annual reports"},
        )
        assert created.status_code == 201
        body = created.json()
        assert body["name"] == "PFE Demo"
        assert body["document_count"] == 0

        listed = client.get("/api/v1/collections")
        assert listed.status_code == 200
        assert any(item["id"] == body["id"] for item in listed.json())

        missing = client.get("/api/v1/collections/does-not-exist")
        assert missing.status_code == 404
