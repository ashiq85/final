import firebase_admin
from firebase_admin import credentials, firestore
import os
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
_db = None

def get_firestore_client():
    global _db
    if _db is None:
        try:
            # Check if already initialized
            if not firebase_admin._apps:
                cred_path = settings.FIREBASE_CREDENTIALS_PATH
                if not os.path.isabs(cred_path):
                    # Resolve relative to backend directory
                    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                    cred_path = os.path.join(base_dir, cred_path)
                
                if not os.path.exists(cred_path):
                    logger.error(f"Firebase credentials not found at {cred_path}")
                    raise FileNotFoundError(f"Firebase credentials not found at {cred_path}")
                
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, {
                    'projectId': settings.FIREBASE_PROJECT_ID,
                })
                logger.info("Firebase Admin SDK initialized successfully")
            
            _db = firestore.client()
        except Exception as e:
            logger.error(f"Error initializing Firebase: {e}")
            raise
    return _db
