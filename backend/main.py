from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.routes import auth, admin, patients, appointments, diagnosis, alerts, encounters, communications, feedback, documents, reports
from app.db.firebase_config import get_firestore_client
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create FastAPI app
# FORCE OVERRIDE for the persistent 404 issue
import os
if os.environ.get("GEMINI_MODEL") == "gemini-1.5-flash":
    os.environ["GEMINI_MODEL"] = "gemini-2.5-flash"
    
settings.GEMINI_MODEL = "gemini-2.5-flash"
print(f"DEBUG_MAIN: settings.GEMINI_MODEL is now: {settings.GEMINI_MODEL}")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Healthcare Management System",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(patients.router, prefix="/api")
app.include_router(appointments.router, prefix="/api")
app.include_router(diagnosis.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(encounters.router, prefix="/api")
app.include_router(communications.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

# Mount static files
os.makedirs("app/static/reports", exist_ok=True)
os.makedirs("app/static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.on_event("startup")
async def startup_event():
    """Initialize Firebase connection on startup"""
    logger.info("Initializing Firebase connection...")
    try:
        get_firestore_client()
        logger.info("Firebase initialized successfully")
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to AgentHealth API",
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
