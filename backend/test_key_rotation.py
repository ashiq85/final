import os
import logging
from app.core.llm import get_llm
from dotenv import load_dotenv

# Configure logging to see rotation warnings
logging.basicConfig(level=logging.WARNING, format='%(levelname)s: %(message)s')

load_dotenv()
raw_keys = os.getenv("GOOGLE_API_KEY")

if not raw_keys:
    print("ERROR: GOOGLE_API_KEY not found in environment.")
    exit(1)

keys = [k.strip() for k in raw_keys.split(",")]
print(f"Testing {len(keys)} API keys: {[k[:10] + '...' for k in keys]}")
print()

try:
    llm = get_llm()
    print(f"LLM initialized: {type(llm).__name__}")
    
    # Attempt to invoke
    print("Sending test request...")
    response = llm.invoke("Say 'YES' if you are working.")
    print(f"SUCCESS! Response: {response.content}")
    
except Exception as e:
    print(f"FINAL FAILURE: {e}")
