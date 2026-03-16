import os
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("ERROR: GOOGLE_API_KEY not found in environment.")
    exit(1)

print(f"Testing key starting with: {api_key[:10]}...")
print()

models_to_test = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-1.0-pro",
    "gemini-pro",
]

for model_name in models_to_test:
    try:
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.7,
        )
        response = llm.invoke("Say 'YES' if you are working.")
        print(f"✅ {model_name}: WORKS! Response: {response.content[:60]}")
        break  # Stop on first working model
    except Exception as e:
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "429" in err:
            print(f"❌ {model_name}: Quota exceeded")
        elif "NOT_FOUND" in err or "404" in err:
            print(f"⚠️  {model_name}: Model not found/not accessible")
        else:
            print(f"❌ {model_name}: Error - {err[:80]}")
