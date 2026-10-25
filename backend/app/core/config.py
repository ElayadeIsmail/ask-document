from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AskDoc"
    debug: bool = False

    data_dir: Path = Field(default=Path("data"))
    max_upload_mb: int = 50
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
        ]
    )

    embedding_model: str = "BAAI/bge-small-en-v1.5"
    reranker_model: str = "BAAI/bge-reranker-base"

    ollama_host: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_timeout_s: float = 180.0

    chunk_size: int = 900
    chunk_overlap: int = 150
    retrieve_k: int = 8
    rerank_k: int = 6

    # Search models load in the background at startup. Tests turn this off.
    preload_models: bool = True
    # Re-queue pending/processing documents after a restart. Tests turn this off.
    resume_on_startup: bool = True

    ocr_enabled: bool = False
    ocr_lang: str = "eng+fra"
    ocr_min_chars: int = 40

    @property
    def resolved_data_dir(self) -> Path:
        path = self.data_dir
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        return path

    @property
    def upload_dir(self) -> Path:
        return self.resolved_data_dir / "uploads"

    @property
    def chroma_dir(self) -> Path:
        return self.resolved_data_dir / "chroma"

    @property
    def sqlite_path(self) -> Path:
        return self.resolved_data_dir / "askdoc.db"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.sqlite_path}"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
