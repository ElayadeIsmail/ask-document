import uuid

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.models import Document, DocumentStatus
from app.db.session import SessionLocal
from app.main import app


def signup(client: TestClient, prefix: str) -> tuple[dict, dict[str, str]]:
    suffix = uuid.uuid4().hex[:10]
    response = client.post(
        "/api/v1/auth/signup",
        json={
            "email": f"{prefix}-{suffix}@example.com",
            "username": f"{prefix}{suffix}",
            "password": "password123",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user"]["role"] == "user"
    return body["user"], {"Authorization": f"Bearer {body['access_token']}"}


def admin_headers(client: TestClient) -> dict[str, str]:
    settings = get_settings()
    response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.admin_email, "password": settings.admin_password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_signup_login_and_me():
    with TestClient(app) as client:
        user, headers = signup(client, "member")
        me = client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["id"] == user["id"]

        logged_out = client.get("/api/v1/collections")
        assert logged_out.status_code == 401

        again = client.post(
            "/api/v1/auth/signup",
            json={
                "email": user["email"],
                "username": f"other{uuid.uuid4().hex[:8]}",
                "password": "password123",
            },
        )
        assert again.status_code == 409


def test_collections_are_private():
    with TestClient(app) as client:
        _owner, owner_headers = signup(client, "owner")
        _other, other_headers = signup(client, "other")
        created = client.post(
            "/api/v1/collections",
            json={"name": "Private", "description": None},
            headers=owner_headers,
        )
        assert created.status_code == 201
        collection_id = created.json()["id"]

        own_list = client.get("/api/v1/collections", headers=owner_headers)
        assert any(item["id"] == collection_id for item in own_list.json())

        other_list = client.get("/api/v1/collections", headers=other_headers)
        assert all(item["id"] != collection_id for item in other_list.json())

        hidden = client.get(f"/api/v1/collections/{collection_id}", headers=other_headers)
        assert hidden.status_code == 404

        unscoped = client.post("/api/v1/ask", json={"question": "What?"}, headers=owner_headers)
        assert unscoped.status_code == 400


def test_share_requires_accept_before_access():
    with TestClient(app) as client:
        owner, owner_headers = signup(client, "sharer")
        recipient, recipient_headers = signup(client, "reader")
        stranger, stranger_headers = signup(client, "stranger")
        created = client.post(
            "/api/v1/collections",
            json={"name": "Shared library"},
            headers=owner_headers,
        )
        assert created.status_code == 201
        collection_id = created.json()["id"]
        document_id = str(uuid.uuid4())
        db = SessionLocal()
        try:
            db.add(
                Document(
                    id=document_id,
                    collection_id=collection_id,
                    filename="notes.pdf",
                    stored_path="/tmp/askdoc-missing.pdf",
                    status=DocumentStatus.pending.value,
                )
            )
            db.commit()
        finally:
            db.close()

        hidden = client.get(f"/api/v1/documents/{document_id}", headers=recipient_headers)
        assert hidden.status_code == 404

        shared = client.post(
            f"/api/v1/documents/{document_id}/shares",
            json={"username": recipient["username"]},
            headers=owner_headers,
        )
        assert shared.status_code == 201, shared.text
        share_id = shared.json()["id"]
        assert shared.json()["status"] == "pending"

        still_hidden = client.get(f"/api/v1/documents/{document_id}", headers=recipient_headers)
        assert still_hidden.status_code == 404
        blocked_chat = client.get(
            f"/api/v1/documents/{document_id}/messages",
            headers=recipient_headers,
        )
        assert blocked_chat.status_code == 404

        incoming = client.get("/api/v1/shares/incoming", headers=recipient_headers)
        assert incoming.status_code == 200
        assert any(item["id"] == share_id for item in incoming.json())

        accepted = client.post(f"/api/v1/shares/{share_id}/accept", headers=recipient_headers)
        assert accepted.status_code == 200
        assert accepted.json()["status"] == "accepted"

        visible = client.get(f"/api/v1/documents/{document_id}", headers=recipient_headers)
        assert visible.status_code == 200
        assert visible.json()["filename"] == "notes.pdf"
        messages = client.get(
            f"/api/v1/documents/{document_id}/messages",
            headers=recipient_headers,
        )
        assert messages.status_code == 200
        assert messages.json() == []

        removed_doc = client.delete(f"/api/v1/documents/{document_id}", headers=recipient_headers)
        assert removed_doc.status_code == 404
        stranger_view = client.get(f"/api/v1/documents/{document_id}", headers=stranger_headers)
        assert stranger_view.status_code == 404

        listed = client.get("/api/v1/admin/users", headers=admin_headers(client))
        assert listed.status_code == 200
        owner_row = next(item for item in listed.json() if item["id"] == owner["id"])
        assert any(item["id"] == document_id for item in owner_row["documents"])
        admin = admin_headers(client)
        admin_view = client.get(f"/api/v1/documents/{document_id}", headers=admin)
        assert admin_view.status_code == 200
        assert client.get("/api/v1/admin/users", headers=recipient_headers).status_code == 403

        removed = client.delete(f"/api/v1/collections/{collection_id}", headers=owner_headers)
        assert removed.status_code == 204
