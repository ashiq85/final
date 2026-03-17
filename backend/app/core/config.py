from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "AgentHealth"
    APP_VERSION: str = "1.0.0"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/agenthealth"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]
    
    # LLM Settings
    LLM_PROVIDER: str = "gemini"  # or "ollama"
    
    # Google Gemini (AI Studio)
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    
    # Ollama Configuration
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama2"
    
    # ChromaDB
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_data"
    
    # CrewAI / LLM
    OPENAI_API_KEY: str = "NA"  # Not used; Gemini is the active provider
    # Firebase
    FIREBASE_PROJECT_ID: str = "agenthealth-e21e0"
    FIREBASE_CREDENTIALS_PATH: str = "serviceAccountKey.json"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    DEBUG: bool = True
    
    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
import os
print(f"DEBUG_CONFIG: os.environ.get('GEMINI_MODEL') = {os.environ.get('GEMINI_MODEL')}")
print(f"DEBUG_CONFIG: settings.GEMINI_MODEL = {settings.GEMINI_MODEL}")

# Export sensitive keys to os.environ so tools/libraries like CrewAI/LiteLLM can see them
import os
if settings.GOOGLE_API_KEY:
    os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY
if settings.GEMINI_MODEL:
    os.environ["GEMINI_MODEL"] = settings.GEMINI_MODEL
if settings.LLM_PROVIDER:
    os.environ["LLM_PROVIDER"] = settings.LLM_PROVIDER
if settings.OLLAMA_BASE_URL:
    os.environ["OLLAMA_BASE_URL"] = settings.OLLAMA_BASE_URL
if settings.OLLAMA_MODEL:
    os.environ["OLLAMA_MODEL"] = settings.OLLAMA_MODEL

