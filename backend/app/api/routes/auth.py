from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from app.db.base import get_db
from app.db.models import User, UserRole, Patient
from app.core.security import verify_password, create_access_token, decode_access_token, get_password_hash
from app.core.config import settings
from app.schemas import Token, UserResponse, UserCreate
from typing import Optional, Any
from functools import wraps
import random
import string
import logging

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
    """Get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    # Firestore query
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
    
    # Check if user already exists
    docs = db.collection("users").where("email", "==", user_data.email).limit(1).stream()
    if any(docs):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        role=user_data.role,
        hashed_password=hashed_password,
        is_active=True
    )
    
    # Save to Firestore
    user_ref = db.collection("users").document()
    user_ref.set(new_user.to_firestore())
    new_user.id = user_ref.id
    
    # Create patient profile with medical ID
    try:
        medical_id = _generate_medical_id(db)
        patient_profile = Patient(
            user_id=new_user.id,
            medical_id=medical_id,
            full_name=new_user.full_name, # Helpful to have redundantly in Patient doc
            email=new_user.email
        )
        db.collection("patients").document().set(patient_profile.to_firestore())
    except Exception as e:
        logger.error(f"Error creating patient profile: {e}")
        # In Firestore we don't have transactions as easily for multi-collection writes in one go 
        # but we could use a write batch. For now keep simple.
    
    return new_user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Any = Depends(get_db)
):
    """Login endpoint"""
    # Firestore query
    docs = db.collection("users").where("email", "==", form_data.username).limit(1).stream()
    user_doc = None
    for doc in docs:
        user_doc = doc
        break
        
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_data = user_doc.to_dict()
    if not verify_password(form_data.password, user_data.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user_data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token = create_access_token(
        data={"sub": user_data["email"], "role": user_data["role"]}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    return current_user

