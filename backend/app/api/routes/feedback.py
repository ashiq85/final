from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any
from app.db.base import get_db
from app.db.models import User, Feedback, UserRole
from app.schemas import FeedbackCreate, FeedbackResponse
from app.api.routes.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/feedback", tags=["Feedback"])

@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    feedback_in: FeedbackCreate,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit feedback, review, or problem (Patients/Doctors)"""
    feedback = Feedback(
        user_id=current_user.id,
        role=current_user.role,
        category=feedback_in.category,
        subject=feedback_in.subject,
        content=feedback_in.content,
        rating=feedback_in.rating
    )
    
    doc_ref = db.collection("feedback").document()
    doc_ref.set(feedback.to_firestore())
    
    data = feedback.model_dump()
    data["id"] = doc_ref.id
    data["created_at"] = feedback.created_at
    return data

@router.get("/", response_model=List[FeedbackResponse])
async def get_all_feedback(
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all feedback (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    docs = db.collection("feedback").order_by("created_at", direction="DESCENDING").stream()
    results = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        results.append(data)
    return results

@router.put("/{feedback_id}/resolve")
async def resolve_feedback(
    feedback_id: str,
    admin_notes: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark feedback as resolved with notes (Admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
        
    doc_ref = db.collection("feedback").document(feedback_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Feedback not found")
        
    doc_ref.update({
        "is_resolved": True,
        "admin_notes": admin_notes,
        "updated_at": datetime.utcnow()
    })
    return {"message": "Feedback resolved successfully"}
