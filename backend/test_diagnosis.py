import requests
import json

base_url = "http://localhost:8000/api"

# First login to get a token
login_data = {"username": "test456@example.com", "password": "password123"}
r = requests.post(f"{base_url}/auth/login", data=login_data)
if r.status_code != 200:
    print("Login failed:", r.json())
    exit()

token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"Logged in successfully. Token: {token[:20]}...")

# Now test the diagnosis endpoint
print("\nTesting diagnosis analysis...")
diag_data = {
    "symptoms": ["chest pain", "shortness of breath", "nausea"],
    "vital_signs": {}
}
r2 = requests.post(f"{base_url}/diagnosis/analyze", json=diag_data, headers=headers)
print(f"Diagnosis Status: {r2.status_code}")
try:
    result = r2.json()
    print(f"Risk Level: {result.get('risk_level')}")
    print(f"Potential Diagnoses: {result.get('potential_diagnosis')}")
    print(f"Recommendations: {result.get('recommendations')}")
    print(f"Emergency: {result.get('emergency_assessment')}")
except Exception as e:
    print("Response text:", r2.text)
    print("Error:", e)
