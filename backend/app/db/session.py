import uuid
from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, select, text, update
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import Base, ChatMessage, Collection, User, UserRole

settings = get_settings()
settings.resolved_data_dir.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_owner_column()
    _ensure_chat_scope()
    _seed_admin()


def _ensure_owner_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("collections"):
        return
    columns = {column["name"] for column in inspector.get_columns("collections")}
    if "owner_id" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE collections ADD COLUMN owner_id VARCHAR(36)"))
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_collections_owner_id ON collections (owner_id)")
        )


def _ensure_chat_scope() -> None:
    """Let a message belong to a collection or a document.

    create_all does not change an existing SQLite table, and a document id used
    to be required. Rebuild the table once so collection threads can be stored.
    """
    inspector = inspect(engine)
    if not inspector.has_table("chat_messages"):
        return
    columns = {column["name"]: column for column in inspector.get_columns("chat_messages")}
    if "collection_id" in columns and columns["document_id"]["nullable"]:
        return
    collection_sql = "collection_id" if "collection_id" in columns else "NULL"
    index_names = [
        index["name"] for index in inspector.get_indexes("chat_messages") if index["name"]
    ]
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE chat_messages RENAME TO chat_messages_old"))
        for name in index_names:
            connection.execute(text(f'DROP INDEX IF EXISTS "{name}"'))
        ChatMessage.__table__.create(connection)
        connection.execute(
            text(
                f"""
                INSERT INTO chat_messages (
                    id, document_id, collection_id, user_id, role, content, citations, created_at
                )
                SELECT
                    id, document_id, {collection_sql}, user_id, role, content, citations, created_at
                FROM chat_messages_old
                """
            )
        )
        connection.execute(text("DROP TABLE chat_messages_old"))


def _seed_admin() -> None:
    config = get_settings()
    db = SessionLocal()
    try:
        admin = db.scalar(select(User).where(User.role == UserRole.admin.value))
        if admin is None:
            admin = User(
                id=str(uuid.uuid4()),
                email=config.admin_email.strip().lower(),
                username=config.admin_username.strip().lower(),
                password_hash=hash_password(config.admin_password),
                role=UserRole.admin.value,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        db.execute(
            update(Collection).where(Collection.owner_id.is_(None)).values(owner_id=admin.id)
        )
        db.commit()
    finally:
        db.close()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
