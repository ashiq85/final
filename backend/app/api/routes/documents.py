from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from typing import List, Any, Optional
from app.db.base import get_db
from app.db.models import Document, User, Patient, UserRole
from app.api.routes.auth import get_current_user
from app.core.rag_service import rag_service
import os
import io
import fitz  # PyMuPDF
from datetime import datetime

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = "app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=dict)
async def upload_document(
    patient_id: str,
    document_type: str,
    process_vector: bool = False,
    file: UploadFile = File(...),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a medical document with optional vector processing"""
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == UserRole.PATIENT:
        if patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_extension = os.path.splitext(file.filename)[1]
    safe_filename = f"{patient_id}_{timestamp}_{document_type}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    document = Document(
        patient_id=patient_id,
        filename=file.filename,
        file_path=file_path,
        file_type=file.content_type,
        file_size=len(content),
        document_type=document_type
    )
    doc_ref = db.collection("documents").document()
    doc_ref.set(document.to_firestore())

    # Optional: Vector indexing (RAG)
    chunks_processed = 0
    if process_vector:
        try:
            text_content = ""
            if file.content_type in ["text/plain", "text/markdown", "application/json"]:
                text_content = content.decode("utf-8")
            elif file.content_type == "application/pdf":
                # Use PyMuPDF for robust extraction
                doc = fitz.open(stream=content, filetype="pdf")
                text_content = ""
                for page in doc:
                    text_content += page.get_text() + "\n"
                doc.close()
            
            if text_content and text_content.strip():
                chunks_processed = await rag_service.process_document(
                    patient_id=patient_id,
                    document_id=doc_ref.id,
                    content=text_content,
                    metadata={"filename": file.filename, "type": document_type}
                )
                doc_ref.update({"is_vectorized": True, "chunks_count": chunks_processed})
            else:
                print(f"Warning: No text extracted from {file.filename}")
        except Exception as e:
            # Don't fail the whole upload if vectorization fails
            print(f"Vectorization failed: {e}")

    return {
        "id": doc_ref.id, 
        "filename": file.filename, 
        "message": "Document uploaded successfully",
        "vectorized": process_vector and chunks_processed > 0,
        "chunks": chunks_processed
    }


@router.get("/patient/{patient_id}", response_model=List[dict])
def get_patient_documents(
    patient_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents for a patient"""
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == UserRole.PATIENT:
        if patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    docs = db.collection("documents").where("patient_id", "==", patient_id).stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        results.append(data)
    return results


@router.get("/search/{patient_id}")
async def search_patient_documents(
    patient_id: str,
    query: str = Query(..., min_length=1),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Perform semantic search across patient's vectorized documents"""
    print(f"DEBUG: Search request for patient {patient_id} with query: {query}")
    # Authorization check
    patient_doc = db.collection("patients").document(patient_id).get()
    if not patient_doc.exists:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    if current_user.role == UserRole.PATIENT:
        if patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
    # Query RAG service
    results = await rag_service.query_patient_records(patient_id, query)
    
    # Format results for frontend
    formatted_results = []
    if results and "documents" in results and len(results["documents"]) > 0:
        docs = results["documents"][0]
        metas = results["metadatas"][0] if "metadatas" in results and results["metadatas"] else ([{}] * len(docs))
        
        for i in range(len(docs)):
            formatted_results.append({
                "content": docs[i],
                "metadata": metas[i] if i < len(metas) else {},
                "score": 0.0 # ChromaDB score if available
            })
            
    return formatted_results


@router.get("/{document_id}", response_model=dict)
def get_document(
    document_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific document"""
    doc = db.collection("documents").document(document_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")

    data = doc.to_dict()
    data['id'] = doc.id

    if current_user.role == UserRole.PATIENT:
        patient_doc = db.collection("patients").document(data.get("patient_id", "")).get()
        if not patient_doc.exists or patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    return data


@router.delete("/{document_id}")
def delete_document(
    document_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document"""
    doc_ref = db.collection("documents").document(document_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")

    data = doc.to_dict()

    if current_user.role == UserRole.DOCTOR:
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.role == UserRole.PATIENT:
        patient_doc = db.collection("patients").document(data.get("patient_id", "")).get()
        if not patient_doc.exists or patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    file_path = data.get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    doc_ref.delete()
    return {"message": "Document deleted successfully"}
