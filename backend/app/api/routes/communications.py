from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Any
from datetime import datetime
from app.db.base import get_db
from app.api.routes.auth import get_current_user
from app.db.models import User
from app.schemas import MessageCreate, MessageResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/communications", tags=["Communications"])

@router.post("/send", response_model=MessageResponse)
async def send_message(
    message: MessageCreate,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Send a direct message or clinical instruction"""
    try:
        # Validate recipient exists
        target_user = db.collection("users").document(message.recipient_id).get()
        if not target_user.exists:
            raise HTTPException(status_code=404, detail="Recipient not found")
            
        sender_id = user.id
        
        # Don't let users spam Admins directly usually, but keep it open for clinical roles
        target_role = target_user.to_dict().get("role")
        sender_role = user.role
        
        # Fetch sender info
        sender_doc = db.collection("users").document(sender_id).get()
        sender_name = sender_doc.to_dict().get("full_name", "Unknown User") if sender_doc.exists else "Unknown"

        msg_data = message.model_dump()
        msg_data["sender_id"] = sender_id
        msg_data["sender_name"] = sender_name
        msg_data["sender_role"] = sender_role
        msg_data["is_read"] = False
        msg_data["created_at"] = datetime.utcnow()
        
        # Save message
        msg_ref = db.collection("messages").document()
        msg_ref.set(msg_data)
        
        # Also create a lightweight notification for the recipient
        notif_data = {
            "user_id": message.recipient_id,
            "notification_type": "new_message",
            "title": f"New Message from {sender_name}",
            "message": message.subject,
            "is_read": False,
            "created_at": datetime.utcnow(),
            "link_id": msg_ref.id
        }
        db.collection("notifications").document().set(notif_data)

        # Prepare response
        response_data = msg_data.copy()
        response_data["id"] = msg_ref.id
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")


@router.get("/{user_id}", response_model=List[MessageResponse])
async def get_inbox(
    user_id: str,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get inbox messages for a user"""
    # Ensure user can only see their own messages, unless they are a doctor
    if user.id != user_id and user.role != 'doctor':
        raise HTTPException(status_code=403, detail="Not authorized to view this inbox")
        
    try:
        messages = []
        docs = db.collection("messages").where("recipient_id", "==", user_id).stream()
        for doc in docs:
            d = doc.to_dict()
            d["id"] = doc.id
            d.setdefault("is_urgent", False)  # backward compat for old messages
            messages.append(d)
            
        # Sort by latest first
        messages.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return messages
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")

@router.put("/{message_id}/read")
async def mark_as_read(
    message_id: str,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Mark a message as read"""
    try:
        msg_ref = db.collection("messages").document(message_id)
        msg_doc = msg_ref.get()
        if not msg_doc.exists:
            raise HTTPException(status_code=404, detail="Message not found")
            
        msg_data = msg_doc.to_dict()
        if msg_data.get("recipient_id") != user.id:
             raise HTTPException(status_code=403, detail="Not authorized")
             
        msg_ref.update({"is_read": True})
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message: {e}")
        raise HTTPException(status_code=500, detail="Failed to update message")

@router.get("/notifications/{user_id}", response_model=List[dict])
async def get_notifications(
    user_id: str,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get active notifications for a user"""
    if user.id != user_id and user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
        
    docs = db.collection("notifications")\
        .where("user_id", "==", user_id)\
        .stream()
        
    results = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        results.append(d)
    
    # Sort by created_at descending (Python-side, avoids composite index requirement)
    results.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
    return results[:50]

@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Mark a notification as read"""
    notif_ref = db.collection("notifications").document(notification_id)
    doc = notif_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    if doc.to_dict().get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    notif_ref.update({"is_read": True})
    return {"status": "success"}

@router.get("/sent/all", response_model=List[MessageResponse])
async def get_sent_messages(
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get messages sent by the current user"""
    try:
        messages = []
        docs = db.collection("messages").where("sender_id", "==", user.id).stream()
        for doc in docs:
            d = doc.to_dict()
            d["id"] = doc.id
            messages.append(d)
            
        messages.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return messages
    except Exception as e:
        logger.error(f"Error fetching sent messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch sent messages")

@router.get("/thread/{other_user_id}", response_model=List[MessageResponse])
async def get_conversation_thread(
    other_user_id: str,
    db: Any = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get full conversation thread between current user and another user"""
    try:
        # Fetch messages where current user is sender and other is recipient
        sent_docs = db.collection("messages")\
            .where("sender_id", "==", user.id)\
            .where("recipient_id", "==", other_user_id)\
            .stream()
            
        # Fetch messages where current user is recipient and other is sender
        received_docs = db.collection("messages")\
            .where("sender_id", "==", other_user_id)\
            .where("recipient_id", "==", user.id)\
            .stream()
            
        messages = []
        for doc in sent_docs:
            d = doc.to_dict()
            d["id"] = doc.id
            d.setdefault("is_urgent", False)  # backward compat
            messages.append(d)
            
        for doc in received_docs:
            d = doc.to_dict()
            d["id"] = doc.id
            d.setdefault("is_urgent", False)  # backward compat
            messages.append(d)
            
        # Sort by latest first
        messages.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return messages
    except Exception as e:
        logger.error(f"Error fetching conversation thread: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch thread")
