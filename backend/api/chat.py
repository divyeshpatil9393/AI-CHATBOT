import json
import logging
from collections.abc import Iterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from exceptions import AppError
from models.schemas import ChatRequest, ChatResponse, Source
from rag.retriever import retriever
from services.groq_service import groq_service

router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _event_stream(messages: list[dict], sources: list[Source]) -> Iterator[str]:
    """Server-Sent Events: sources -> token* -> (error) -> done."""
    if sources:
        yield _sse({"type": "sources", "sources": [s.model_dump() for s in sources]})
    try:
        for token in groq_service.stream(messages):
            yield _sse({"type": "token", "content": token})
    except AppError as exc:
        yield _sse({"type": "error", "message": exc.message})
    except Exception:
        logger.exception("Unexpected streaming failure")
        yield _sse({"type": "error", "message": "Something went wrong while generating the answer."})
    yield _sse({"type": "done"})


@router.post("/chat")
def chat(request: ChatRequest):
    groq_service.ensure_ready()  # fail fast with a clear message if the key is missing

    retrieval = retriever.retrieve(
        question=request.message,
        history=request.history,
        document_ids=request.document_ids,
        top_k=request.top_k,
    )
    messages = groq_service.build_messages(
        question=request.message,
        history=request.history,
        context=retrieval.context,
        intent=retrieval.intent,
        documents_selected=retrieval.documents_selected,
    )
    sources = retrieval.sources

    if not request.stream:
        return ChatResponse(answer=groq_service.complete(messages), sources=sources)

    return StreamingResponse(
        _event_stream(messages, sources),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
