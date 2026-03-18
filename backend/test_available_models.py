import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("ERROR: GOOGLE_API_KEY not found")
    exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"

print(f"Testing URL: {url.replace(api_key, 'KEY_HIDDEN')}")
try:
    response = requests.get(url)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        models = response.json().get('models', [])
        print("Available models:")
        for m in models:
            if 'generateContent' in m.get('supportedGenerationMethods', []):
                print(f"  - {m.get('name')}")
    else:
        print("Response JSON:")
        print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
