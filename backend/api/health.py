from fastapi import APIRouter

from config import settings
from models.schemas import HealthResponse
from rag.vector_store import get_vector_store
from services import document_service

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        get_vector_store()
        vector_status = "ok"
    except Exception:
        vector_status = "unavailable"
    return HealthResponse(
        status="ok",
        groq_configured=settings.has_api_key,  # never returns the key itself
        model=settings.groq_model,
        embedding_model=settings.embedding_model,
        vector_store=vector_status,
        documents=len(document_service.list_documents()),
        max_upload_mb=settings.max_upload_mb,
    )
