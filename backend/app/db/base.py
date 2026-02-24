from app.db.firebase_config import get_firestore_client


def get_db():
    """Database dependency yielding Firestore client"""
    db = get_firestore_client()
    try:
        yield db
    finally:
        # Firestore client doesn't need explicit close
        pass
