"""Central configuration. All secrets and tunables come from environment variables."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Root .env is preferred; backend/.env also works.
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _get_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


class Settings:
    def __init__(self) -> None:
        # LLM (Groq)
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "").strip()
        self.groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
        self.llm_temperature: float = _get_float("LLM_TEMPERATURE", 0.2)
        self.llm_max_tokens: int = _get_int("LLM_MAX_TOKENS", 1024)

        # NLP / RAG
        self.embedding_model: str = os.getenv(
            "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
        self.chunk_size: int = max(200, _get_int("CHUNK_SIZE", 800))
        # Overlap can never exceed half a chunk, otherwise chunking would barely advance.
        self.chunk_overlap: int = min(max(0, _get_int("CHUNK_OVERLAP", 150)), self.chunk_size // 2)
        self.top_k: int = max(1, _get_int("TOP_K", 5))
        self.min_similarity: float = _get_float("MIN_SIMILARITY", 0.15)
        self.max_context_chars: int = _get_int("MAX_CONTEXT_CHARS", 7000)
        self.max_history_messages: int = _get_int("MAX_HISTORY_MESSAGES", 12)

        # Uploads
        self.max_upload_mb: int = max(1, _get_int("MAX_UPLOAD_MB", 15))
        self.max_chunks_per_document: int = _get_int("MAX_CHUNKS_PER_DOCUMENT", 3000)

        # HTTP
        origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        self.cors_origins: list[str] = [o.strip() for o in origins.split(",") if o.strip()]

        # Paths
        self.uploads_dir: Path = BASE_DIR / "uploads"
        self.data_dir: Path = BASE_DIR / "data"
        self.chroma_dir: Path = self.data_dir / "chroma"
        self.registry_path: Path = self.data_dir / "documents.json"
        for directory in (self.uploads_dir, self.data_dir, self.chroma_dir):
            directory.mkdir(parents=True, exist_ok=True)

    @property
    def has_api_key(self) -> bool:
        return bool(self.groq_api_key) and self.groq_api_key != "your_api_key"


settings = Settings()
