from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from app.db.base import get_db
from app.db.models import User, UserRole, Patient
from app.core.security import verify_password, create_access_token, decode_access_token, get_password_hash
from app.core.config import settings
from app.schemas import Token, UserResponse, UserCreate, UserLogin
from typing import Optional, Any
from functools import wraps
import random
import string
import logging
from firebase_admin import auth as firebase_auth

logger = logging.getLogger(__name__)


def _generate_medical_id(db: Any) -> str:
    """Generate a unique medical ID in the format AH-XXXXX"""
    while True:
        digits = ''.join(random.choices(string.digits, k=5))
        medical_id = f"AH-{digits}"
        # Firestore query
        docs = db.collection("patients").where("medical_id", "==", medical_id).limit(1).stream()
        exists = any(docs)
        if not exists:
            return medical_id


router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Any = Depends(get_db)
) -> User:
    """Get current authenticated user from Firebase ID Token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Verify the Firebase ID token with clock skew tolerance
        payload = firebase_auth.verify_id_token(token, clock_skew_seconds=60)
    except Exception as e:
        logger.error(f"Error validating Firebase token: {e}")
        raise credentials_exception

        
    email: str = payload.get("email")
    if email is None:
        raise credentials_exception
    
    # Firestore query to get the rich user profile
    docs = db.collection("users").where("email", "==", email).limit(1).stream()
    user_doc = None
    for doc in docs:
        user_doc = doc
        break
        
    if user_doc is None:
        raise credentials_exception
    
    user_data = user_doc.to_dict()
    user_data['id'] = user_doc.id
    return User(**user_data)


def require_role(*allowed_roles: UserRole):
    """Decorator to require specific user roles"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, current_user: User = Depends(get_current_user), **kwargs):
            if current_user.role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Required roles: {[role.value for role in allowed_roles]}"
                )
            return await func(*args, current_user=current_user, **kwargs)
        return wrapper
    return decorator


@router.post("/migrate-legacy", status_code=status.HTTP_200_OK)
async def migrate_legacy_user(
    credentials: UserLogin,
    db: Any = Depends(get_db)
):
    """Migrate legacy users from Firestore to Firebase Auth"""
    # 1. Retrieve the user from Firestore
    docs = list(db.collection("users").where("email", "==", credentials.email).limit(1).stream())
    if not docs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Legacy user not found. Please sign up."
        )
    
    user_doc = docs[0]
    user_data = user_doc.to_dict()
    
    # 2. Verify their legacy password
    if not verify_password(credentials.password, user_data.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
        
    # 3. Create or update them in Firebase Auth
    try:
        try:
            firebase_user = firebase_auth.get_user_by_email(credentials.email)
            firebase_auth.update_user(
                firebase_user.uid,
                password=credentials.password
            )
            firebase_uid = firebase_user.uid
        except firebase_auth.UserNotFoundError:
            firebase_user = firebase_auth.create_user(
                email=credentials.email,
                password=credentials.password,
                display_name=user_data.get("full_name", "User")
            )
            firebase_uid = firebase_user.uid
            
        # 4. If the old Firestore document ID doesn't match the new Firebase UID,
        # we need to migrate the user document over
        if user_doc.id != firebase_uid:
            new_user_ref = db.collection("users").document(firebase_uid)
            new_user_ref.set(user_data)
            
            # Find and update the patient document linked to this user
            pat_docs = db.collection("patients").where("user_id", "==", user_doc.id).stream()
            for p_doc in pat_docs:
                db.collection("patients").document(p_doc.id).update({"user_id": firebase_uid})
                
            # Optional: Delete the old user doc if we want a clean migration
            # db.collection("users").document(user_doc.id).delete()
            
        return {"status": "success", "message": "Legacy user successfully migrated to Firebase."}
            
    except Exception as e:
        logger.error(f"Failed to migrate legacy user to Firebase: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Migration failed: {str(e)}"
        )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    user_data: UserCreate,
    db: Any = Depends(get_db)
):
    """Patient self-registration endpoint"""
    # Only allow patient signup through this endpoint
    if user_data.role != UserRole.PATIENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only patient registration is allowed through signup"
        )
    
    # Check if user already exists in Firestore
    docs = list(db.collection("users").where("email", "==", user_data.email).limit(1).stream())
    if docs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please log in instead."
        )
    
    # Create or get user in Firebase Auth
    firebase_uid = None
    try:
        try:
            firebase_user = firebase_auth.get_user_by_email(user_data.email)
            # User exists in Firebase Auth but NOT in Firestore — let's fix their account
            logger.info(f"Found existing Firebase user for {user_data.email}, syncing Firestore...")
            firebase_auth.update_user(
                firebase_user.uid,
                password=user_data.password,
                display_name=user_data.full_name
            )
            firebase_uid = firebase_user.uid
        except firebase_auth.UserNotFoundError:
            firebase_user = firebase_auth.create_user(
                email=user_data.email,
                password=user_data.password,
                display_name=user_data.full_name
            )
            firebase_uid = firebase_user.uid
            logger.info(f"Created new Firebase Auth user with UID: {firebase_uid}")
    except Exception as e:
        logger.error(f"Failed to create Firebase Auth user for Signup: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create authentication account: {str(e)}"
        )

    # Save to Firestore using Firebase UID
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        hashed_password=hashed_password,
        is_active=True
    )
    
    user_ref = db.collection("users").document(firebase_uid)
    user_ref.set(new_user.to_firestore())
    new_user.id = firebase_uid
    logger.info(f"Saved user document to Firestore with id: {firebase_uid}")
    
    # Create patient profile with medical ID
    try:
        medical_id = _generate_medical_id(db)
        patient_profile = Patient(
            user_id=new_user.id,
            medical_id=medical_id,
            full_name=new_user.full_name,
            email=new_user.email
        )
        db.collection("patients").document().set(patient_profile.to_firestore())
        logger.info(f"Created patient profile with medical_id: {medical_id}")
    except Exception as e:
        logger.error(f"Error creating patient profile: {e}")
    
    return new_user


# Login endpoint removed. Authentication is now handled by the Firebase JS SDK on the frontend,
# which provides an ID token that is verified by `get_current_user`.


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return current_user

