from fastapi import APIRouter, File, UploadFile
from fastapi import Path as PathParam

from models.schemas import DeleteResponse, DocumentList, DocumentMeta
from services import document_service

router = APIRouter(tags=["documents"])


# Plain `def` routes run in FastAPI's threadpool, so heavy embedding work doesn't block the server.
@router.post("/documents/upload", response_model=DocumentMeta, status_code=201)
def upload_document(file: UploadFile = File(...)) -> DocumentMeta:
    return document_service.ingest_upload(file)


@router.get("/documents", response_model=DocumentList)
def list_documents() -> DocumentList:
    return DocumentList(documents=document_service.list_documents())


@router.delete("/documents/{document_id}", response_model=DeleteResponse)
def delete_document(document_id: str = PathParam(..., pattern=r"^[a-f0-9]{32}$")) -> DeleteResponse:
    document_service.delete_document(document_id)
    return DeleteResponse(deleted=True, document_id=document_id)
