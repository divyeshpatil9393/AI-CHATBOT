"""FastAPI application entry point.

Run from the backend folder:  uvicorn main:app --reload --port 8000
"""
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api import chat, documents, health
from config import settings
from exceptions import AppError
from nlp.embeddings import get_embedder

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app")


def _warm_up_embedder() -> None:
    try:
        get_embedder().load()
    except Exception:
        logger.warning("Embedding model warm-up failed; it will be retried on first use.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.has_api_key:
        logger.warning("GROQ_API_KEY is not set. Chat will return an error until you add it to .env")
    # Load the embedding model in the background so the first upload isn't slow.
    threading.Thread(target=_warm_up_embedder, daemon=True).start()
    yield


app = FastAPI(title="Lumina AI Chatbot API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.exception_handler(AppError)
async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    if exc.status_code >= 500:
        logger.error("%s: %s", exc.code, exc.message)
    return _error(exc.status_code, exc.code, exc.message)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    message = str(first.get("msg", "Invalid request.")).removeprefix("Value error, ")
    return _error(422, "validation_error", message)


@app.exception_handler(Exception)
async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error")  # full trace stays in the server log only
    return _error(500, "internal_error", "Something went wrong on the server. Please try again.")


app.include_router(health.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
