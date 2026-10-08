"""Pydantic request/response models."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=20000)


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=8000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=100)
    # Documents the user wants this chat grounded in. Empty = plain chat (no retrieval).
    document_ids: list[str] = Field(default_factory=list, max_length=20)
    top_k: int | None = Field(default=None, ge=1, le=10)
    stream: bool = True

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Please enter a message.")
        return value


class Source(BaseModel):
    document_id: str
    filename: str
    page: int | None = None
    score: float
    snippet: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source] = Field(default_factory=list)


class DocumentMeta(BaseModel):
    document_id: str
    filename: str
    file_type: str
    size_bytes: int
    pages: int
    pages_estimated: bool = False  # true for DOCX/TXT, which have no fixed pages
    chunks: int
    characters: int
    status: str = "processed"
    uploaded_at: str


class DocumentList(BaseModel):
    documents: list[DocumentMeta]


class DeleteResponse(BaseModel):
    deleted: bool
    document_id: str


class HealthResponse(BaseModel):
    status: str
    groq_configured: bool
    model: str
    embedding_model: str
    vector_store: str
    documents: int
    max_upload_mb: int
