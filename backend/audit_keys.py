import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
raw_keys = os.getenv("GOOGLE_API_KEY")
model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

if not raw_keys:
    print("ERROR: GOOGLE_API_KEY not found in .env")
    exit(1)

keys = [k.strip() for k in raw_keys.split(",")]
print(f"--- Gemini API Key Audit ---")
print(f"Model being tested: {model}")
print(f"Total keys found: {len(keys)}")
print("-" * 30)

for i, key in enumerate(keys):
    display_key = f"{key[:10]}...{key[-4:]}"
    print(f"Testing Key {i+1}: {display_key}")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    headers = {'Content-Type': 'application/json'}
    data = {"contents": [{"parts": [{"text": "Say ok"}]}]}
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        res_json = response.json()
        
        if response.status_code == 200:
            print(f"  ✅ SUCCESS: Key is working perfectly.")
        elif response.status_code == 429:
            print(f"  ❌ QUOTA EXHAUSTED: Hits the free tier limit. (Wait for reset or use billing)")
        elif response.status_code == 400:
            reason = res_json.get('error', {}).get('status', 'Unknown error')
            msg = res_json.get('error', {}).get('message', '')
            if "API_KEY_INVALID" in str(res_json):
                print(f"  🚫 INVALID KEY: This key is not valid or was copied incorrectly.")
            else:
                print(f"  ⚠️  BAD REQUEST (400): {reason} - {msg}")
        elif response.status_code == 403:
            print(f"  🔒 PERMISSION DENIED: Generative Language API not enabled for this project.")
        else:
            print(f"  ❓ ERROR {response.status_code}: {res_json.get('error', {}).get('message', 'Unknown Error')}")
            
    except Exception as e:
        print(f"  🔥 CONNECTION ERROR: {e}")
    print("-" * 30)
