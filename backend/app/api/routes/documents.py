from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query
from fastapi.responses import FileResponse, StreamingResponse
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

UPLOAD_DIR = "app/static/uploads"
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
    ai_summary_text = ""
    
    if process_vector:
        try:
            text_content = ""
            # Determine how to extract text — check both content_type AND file extension as fallback
            fname_lower = (file.filename or "").lower()
            ct = (file.content_type or "").lower()
            if ct in ["text/plain", "text/markdown", "application/json"] or fname_lower.endswith(('.txt', '.md', '.json')):
                text_content = content.decode("utf-8", errors="ignore")
            elif ct == "application/pdf" or fname_lower.endswith('.pdf'):
                doc = fitz.open(stream=content, filetype="pdf")
                text_content = ""
                for page in doc:
                    text_content += page.get_text() + "\n"
                doc.close()
            
            if text_content and text_content.strip():
                # Generate AI Summary
                try:
                    llm = get_llm()
                    summary_prompt = f"Summarize the following medical document in 1-2 concise sentences. Focus on the core findings.\n\nDocument Text:\n{text_content[:4000]}"
                    ai_resp = await llm.ainvoke(summary_prompt)
                    ai_summary_text = ai_resp.content.strip()
                except Exception as summ_err:
                    print(f"[RAG] Summary generation failed: {summ_err}")
                    ai_summary_text = text_content[:200] + "..."

                chunks_processed = await rag_service.process_document(
                    patient_id=patient_id,
                    document_id=doc_ref.id,
                    content=text_content,
                    metadata={"filename": file.filename, "type": document_type}
                )
                doc_ref.update({
                    "is_vectorized": True, 
                    "chunks_count": chunks_processed,
                    "extracted_data": {"summary": ai_summary_text}
                })
        except Exception as e:
            print(f"[RAG] Vectorization failed: {e}")

    return {
        "id": doc_ref.id, 
        "filename": file.filename, 
        "message": "Document uploaded successfully",
        "vectorized": process_vector and chunks_processed > 0,
        "summary": ai_summary_text
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
        # Optimization: Use top 3 results for synthesis to reduce latency/tokens
        top_results = formatted_results[:3]
        context_text = "\n".join([f"DOC: {r['metadata'].get('filename', 'Unknown')} > {r['content'][:400]}" for r in top_results])
        
        try:
            prompt = f"""Synthesize a brief clinical answer (max 3 sentences) from these record snippets.
            
            CONTEXT:
            {context_text}
            
            QUERY: {query}
            
            ANSWER (Formal & Precise):"""
            
            llm = get_llm()
            response = await llm.ainvoke(prompt)
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
async def delete_document(
    document_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document and its vector embeddings"""
    doc_ref = db.collection("documents").document(document_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")

    data = doc.to_dict()
    patient_id = data.get("patient_id")

    # Doctors can delete if they have patient access (implied by patient existence check for now)
    if current_user.role == UserRole.PATIENT:
        if data.get("user_id") != current_user.id:
            # Patient can only delete their own
            patient_doc = db.collection("patients").document(patient_id).get()
            if not patient_doc.exists or patient_doc.to_dict().get("user_id") != current_user.id:
                raise HTTPException(status_code=403, detail="Not authorized")

    # 1. Delete from vector store
    if data.get("is_vectorized"):
        await rag_service.delete_patient_document(patient_id, document_id)

    # 2. Delete from filesystem
    file_path = data.get("file_path")
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Error removing file {file_path}: {e}")

    # 3. Delete from Firestore
    doc_ref.delete()
    return {"message": "Document and associated AI data deleted successfully"}


@router.get("/{document_id}/view")
async def view_document(
    document_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Serve a document for inline viewing"""
    doc = db.collection("documents").document(document_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")
    
    data = doc.to_dict()
    # auth check
    if current_user.role == UserRole.PATIENT:
        patient_doc = db.collection("patients").document(data.get("patient_id", "")).get()
        if not patient_doc.exists or patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    file_path = data.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(file_path, media_type=data.get("file_type", "application/octet-stream"))


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Serve a document for forced download"""
    doc = db.collection("documents").document(document_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Document not found")
    
    data = doc.to_dict()
    # auth check
    if current_user.role == UserRole.PATIENT:
        patient_doc = db.collection("patients").document(data.get("patient_id", "")).get()
        if not patient_doc.exists or patient_doc.to_dict().get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized")

    file_path = data.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        file_path, 
        media_type=data.get("file_type", "application/octet-stream"),
        filename=data.get("filename")
    )
