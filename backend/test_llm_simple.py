import os
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

models_to_test = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"]

for model_name in models_to_test:
    print(f"\n--- Testing model: {model_name} ---")
    try:
        # Try default
        llm = ChatGoogleGenerativeAI(model=model_name, google_api_key=api_key)
        res = llm.invoke("Hello, respond with 'OK'")
        print(f"Success (default)! Response: {res.content}")
        print(f"FOUND WORKING MODEL: {model_name}")
        break
    except Exception as e:
        print(f"Failed (default): {e}")
        
    try:
        # Try explicitly setting version to v1
        llm = ChatGoogleGenerativeAI(model=model_name, google_api_key=api_key, version="v1")
        res = llm.invoke("Hello, respond with 'OK'")
        print(f"Success (v1)! Response: {res.content}")
        print(f"FOUND WORKING MODEL: {model_name} (v1)")
        break
    except Exception as e:
        print(f"Failed (v1): {e}")
