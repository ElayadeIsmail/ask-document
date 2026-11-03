import json
import uuid

from fastapi.testclient import TestClient

from app.db.models import Document, DocumentStatus
from app.db.session import SessionLocal
from app.main import app
from app.schemas.qa import AskResponse, Citation
from app.services.rag import PreparedAsk
from tests.test_auth import signup


class FakeRAG:
    def __init__(self) -> None:
        self.requests = []

    def prepare(self, request):
        self.requests.append(request)
        return PreparedAsk(
            question=request.question,
            hits=[],
            prompt="prompt",
            temperature=request.temperature,
        )

    def iter_answer(self, _prepared):
        yield "Saved "
        yield "answer"

    def complete(self, prepared, answer: str) -> AskResponse:
        return AskResponse(
            question=prepared.question,
            answer=answer,
            citations=[
                Citation(
                    n=1,
                    document_id="doc",
                    filename="notes.pdf",
                    page=2,
                    snippet="A cited line",
                    score=0.8,
                )
            ],
            sources=[],
            model="fake",
        )


def _events(body: str) -> list[dict]:
    found = []
    for chunk in body.split("\n\n"):
        line = next((item for item in chunk.split("\n") if item.startswith("data: ")), None)
        if line:
            found.append(json.loads(line[6:]))
    return found


def test_document_and_collection_chats_stream_and_persist():
    fake = FakeRAG()
    with TestClient(app) as client:
        app.state.rag = fake
        owner, headers = signup(client, "chatter")
        other, other_headers = signup(client, "outsider")
        created = client.post("/api/v1/collections", headers=headers, json={"name": "Library"})
        assert created.status_code == 201, created.text
        collection_id = created.json()["id"]
        document_id = str(uuid.uuid4())
        db = SessionLocal()
        try:
            db.add(
                Document(
                    id=document_id,
                    collection_id=collection_id,
                    filename="notes.pdf",
                    stored_path="/tmp/askdoc-chat.pdf",
                    status=DocumentStatus.ready.value,
                )
            )
            db.commit()
        finally:
            db.close()

        hidden = client.get(f"/api/v1/collections/{collection_id}/messages", headers=other_headers)
        assert hidden.status_code == 404

        collection_stream = client.post(
            f"/api/v1/collections/{collection_id}/messages/stream",
            headers=headers,
            json={"question": "What is in the library?"},
        )
        assert collection_stream.status_code == 200, collection_stream.text
        collection_events = _events(collection_stream.text)
        assert [event["type"] for event in collection_events] == [
            "sources",
            "token",
            "token",
            "done",
        ]
        streamed = "".join(event["text"] for event in collection_events if event["type"] == "token")
        assert streamed == "Saved answer"
        assert collection_events[-1]["answer"] == "Saved answer"

        saved = client.get(f"/api/v1/collections/{collection_id}/messages", headers=headers)
        assert saved.status_code == 200
        roles = [item["role"] for item in saved.json()]
        assert roles == ["user", "assistant"]
        assert saved.json()[0]["content"] == "What is in the library?"
        assert saved.json()[0]["username"] == owner["username"]
        assert saved.json()[1]["citations"][0]["page"] == 2
        assert saved.json()[0]["collection_id"] == collection_id
        assert saved.json()[0]["document_id"] is None

        again = client.post(
            f"/api/v1/collections/{collection_id}/messages/stream",
            headers=headers,
            json={"question": "And the second question?", "document_ids": [document_id]},
        )
        assert again.status_code == 200, again.text
        assert fake.requests[-1].history[0].question == "What is in the library?"
        assert fake.requests[-1].document_ids == [document_id]

        stranger = client.post(
            f"/api/v1/collections/{collection_id}/messages/stream",
            headers=other_headers,
            json={"question": "Can I see this?", "document_ids": [document_id]},
        )
        assert stranger.status_code == 404

        document_stream = client.post(
            f"/api/v1/documents/{document_id}/messages/stream",
            headers=headers,
            json={"question": "What is on page 2?"},
        )
        assert document_stream.status_code == 200, document_stream.text
        document_events = _events(document_stream.text)
        assert document_events[-1]["type"] == "done"
        assert document_events[-1]["answer"] == "Saved answer"

        document_messages = client.get(f"/api/v1/documents/{document_id}/messages", headers=headers)
        assert document_messages.status_code == 200
        assert [item["role"] for item in document_messages.json()] == ["user", "assistant"]
        assert document_messages.json()[0]["document_id"] == document_id
        assert document_messages.json()[0]["collection_id"] is None
        assert other["id"] != owner["id"]
