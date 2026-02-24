from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
import os

def get_llm():
    """
    Initialize and return the Gemini LLM instance.
    Uses GOOGLE_API_KEY from environment variables.
    """
    api_key = settings.GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY")
    
    if not api_key or api_key == "":
        # Return none or raise error if not configured, 
        # but for CrewAI we usually need an object or it fails at runtime
        raise ValueError("GOOGLE_API_KEY is not set in configuration or environment")
        
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=api_key,
        temperature=0.7,
    )
