from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from typing import List, Any, Optional
from app.db.base import get_db
from app.db.models import Document, User, Patient, UserRole
from app.api.routes.auth import get_current_user
from app.core.rag_service import rag_service
from app.core.llm import get_llm
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
            # Determine how to extract text — check both content_type AND file extension as fallback
            fname_lower = (file.filename or "").lower()
            ct = (file.content_type or "").lower()
            if ct in ["text/plain", "text/markdown", "application/json"] or fname_lower.endswith(('.txt', '.md', '.json')):
                text_content = content.decode("utf-8", errors="ignore")
            elif ct == "application/pdf" or fname_lower.endswith('.pdf'):
                # Use PyMuPDF for robust extraction
                import fitz  # pyMuPDF
                doc = fitz.open(stream=content, filetype="pdf")
                text_content = ""
                for page in doc:
                    text_content += page.get_text() + "\n"
                doc.close()
                print(f"[RAG] Extracted {len(text_content)} chars from PDF '{file.filename}'")
            else:
                print(f"[RAG] Unsupported file type for vectorization: content_type={ct}, filename={file.filename}")
            
            if text_content and text_content.strip():
                chunks_processed = await rag_service.process_document(
                    patient_id=patient_id,
                    document_id=doc_ref.id,
                    content=text_content,
                    metadata={"filename": file.filename, "type": document_type}
                )
                doc_ref.update({"is_vectorized": True, "chunks_count": chunks_processed})
                print(f"[RAG] Successfully indexed {chunks_processed} chunks for document '{file.filename}'")
            else:
                print(f"[RAG] Warning: No text extracted from '{file.filename}' (content_type={ct})")
        except Exception as e:
            # Don't fail the whole upload if vectorization fails
            import traceback
            print(f"[RAG] Vectorization failed for '{file.filename}': {e}")
            traceback.print_exc()

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
            
    # AI Synthesis: Answer the user query using the retrieved context
    answer = ""
    if formatted_results:
        try:
            context_text = "\n\n".join([f"Source {i+1}:\n{r['content']}" for i, r in enumerate(formatted_results[:3])])
            prompt = f"""You are a medical assistant reviewing a patient's records. 
            Based ONLY on the following snippets from the patient's documents, answer the user's question concisely.
            If the answer is not in the context, say you don't have enough information.
            
            Context:
            {context_text}
            
            Question: {query}
            
            Answer:"""
            
            llm = get_llm()
            response = llm.invoke(prompt)
            answer = response.content.strip()
            print(f"DEBUG: AI Search Synthesis Success")
        except ValueError as e:
            # API key not configured
            print(f"[RAG] LLM not available (missing API key): {e}")
            all_text = " ".join([r["content"] for r in formatted_results[:2]])
            excerpt = all_text[:600].strip() + ("..." if len(all_text) > 600 else "")
            answer = f"📋 Relevant document excerpt:\n\n{excerpt}\n\n(AI synthesis unavailable: valid GOOGLE_API_KEY required)"
        except Exception as e:
            err_msg = str(e).lower()
            print(f"[RAG] Search synthesis failed: {e}")
            
            # Local fallback (Document Excerpt)
            all_text = " ".join([r["content"] for r in formatted_results[:2]])
            excerpt = all_text[:600].strip() + ("..." if len(all_text) > 600 else "")
            
            if "resource_exhausted" in err_msg or "429" in err_msg:
                answer = f"📋 Note: AI quota reached. Showing document excerpt instead:\n\n{excerpt}"
            elif "not_found" in err_msg or "404" in err_msg:
                answer = f"📋 Note: AI model not found. Showing document excerpt instead:\n\n{excerpt}"
            elif "invalid_argument" in err_msg or "400" in err_msg:
                answer = f"📋 Note: AI processing failed. Showing document excerpt instead:\n\n{excerpt}"
            else:
                answer = f"📋 Found {len(formatted_results)} relevant documents. Summarization failed, showing excerpt:\n\n{excerpt}"

    return {
        "query": query,
        "answer": answer,
        "results": formatted_results
    }


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
