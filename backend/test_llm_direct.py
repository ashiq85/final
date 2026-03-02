import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
model_name = os.getenv("GEMINI_MODEL")

print(f"Testing Gemini Model: {model_name}")

try:
    llm = ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=api_key,
        temperature=0.7,
    )
    response = llm.invoke("Hello, are you functional?")
    print("Response successful!")
    print(response.content)
except Exception as e:
    print(f"Error: {e}")
