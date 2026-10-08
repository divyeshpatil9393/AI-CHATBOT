"""Application errors. Each carries a safe, user-facing message and an HTTP status."""


class AppError(Exception):
    status_code = 500
    code = "internal_error"
    default_message = "Something went wrong. Please try again."

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.default_message
        super().__init__(self.message)


class InvalidFileError(AppError):
    status_code = 400
    code = "invalid_file"
    default_message = "This file doesn't look valid."


class UnsupportedFileTypeError(AppError):
    status_code = 415
    code = "unsupported_file_type"
    default_message = "Unsupported file type. Upload a PDF, DOCX, or TXT file."


class FileTooLargeError(AppError):
    status_code = 413
    code = "file_too_large"
    default_message = "This file is too large."


class EmptyDocumentError(AppError):
    status_code = 422
    code = "empty_document"
    default_message = "No readable text was found in this document."


class CorruptedDocumentError(AppError):
    status_code = 422
    code = "corrupted_document"
    default_message = "This file couldn't be read. It may be corrupted."


class DocumentNotFoundError(AppError):
    status_code = 404
    code = "document_not_found"
    default_message = "Document not found."


class VectorStoreError(AppError):
    status_code = 503
    code = "vector_store_error"
    default_message = "The document search index is unavailable. Please try again."


class EmbeddingError(AppError):
    status_code = 503
    code = "embedding_error"
    default_message = "The embedding model is unavailable. Please try again."


class LLMConfigError(AppError):
    status_code = 503
    code = "missing_api_key"
    default_message = "The server has no Groq API key. Add GROQ_API_KEY to your .env file and restart the backend."


class LLMError(AppError):
    status_code = 502
    code = "llm_error"
    default_message = "The AI service returned an error. Please try again."


class LLMRateLimitError(LLMError):
    status_code = 429
    code = "rate_limited"
    default_message = "The AI service is rate limited right now. Wait a moment and try again."
