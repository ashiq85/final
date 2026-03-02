"""List available Gemini models for the current API key"""
import sys, os
sys.path.insert(0, os.getcwd())

from app.core.config import settings
import google.generativeai as genai

genai.configure(api_key=settings.GOOGLE_API_KEY)

print("Available models that support generateContent:")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(f"  - {m.name}")
