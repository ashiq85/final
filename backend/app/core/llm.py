from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
import os

import random
import logging

logger = logging.getLogger(__name__)

class RotatingLangChainLLM:
    """Wrapper that rotates through multiple Gemini API keys on quota failure"""
    def __init__(self, keys, model_name, temperature=0.7):
        self.keys = [k.strip() for k in keys if k.strip()]
        self.model_name = model_name
        self.temperature = temperature
        self.current_index = 0
        
    def _get_llm_instance(self, key):
        return ChatGoogleGenerativeAI(
            model=self.model_name,
            google_api_key=key,
            temperature=self.temperature,
        )

    def invoke(self, *args, **kwargs):
        """Invoke the LLM, rotating keys if a 429 error occurs"""
        attempts = len(self.keys)
        last_error = None
        
        for _ in range(attempts):
            current_key = self.keys[self.current_index]
            try:
                llm = self._get_llm_instance(current_key)
                return llm.invoke(*args, **kwargs)
            except Exception as e:
                err_msg = str(e).lower()
                if "429" in err_msg or "resource_exhausted" in err_msg:
                    logger.warning(f"Quota hit for API Key index {self.current_index}. Rotating to next key...")
                    self.current_index = (self.current_index + 1) % len(self.keys)
                    last_error = e
                    continue
                else:
                    # Non-quota error, re-raise immediately
                    raise e
        
        # If we exhausted all keys
        logger.error("All Gemini API keys have exhausted their quota.")
        raise last_error

def get_llm():
    """
    Initialize and return the Gemini LLM instance with key rotation support.
    Supports comma-separated GOOGLE_API_KEY.
    """
    raw_keys = settings.GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY")
    
    if not raw_keys or raw_keys == "":
        raise ValueError("GOOGLE_API_KEY is not set in configuration or environment")
    
    # Check if multiple keys are provided
    keys = raw_keys.split(",")
    
    if len(keys) > 1:
        logger.info(f"Initialized LLM with {len(keys)} rotating API keys.")
        return RotatingLangChainLLM(keys, settings.GEMINI_MODEL)
    else:
        # Single key mode
        return ChatGoogleGenerativeAI(
            model=settings.GEMINI_MODEL,
            google_api_key=keys[0].strip(),
            temperature=0.7,
        )
