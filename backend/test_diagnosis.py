import asyncio
import httpx

async def test_diagnosis_analyze():
    # Login to get token
    login_payload = {
        "email": "admin@hotel.com",
        "password": "admin123"
    }
    
    async with httpx.AsyncClient() as client:
        # First login
        login_res = await client.post("http://localhost:8000/api/auth/migrate-legacy", json=login_payload)
        # Note: If already migrated, this might be 404. Let's try signup or assume it works if we have the token
        # Actually, let's just try to hit it.
        
        payload = {
            "symptoms": ["chest pain"],
            "patient_id": None,
            "vital_signs": {}
        }
        
        # We need a token. Let's try to get one from the login route if migrate-legacy fails
        # But wait, migrate-legacy DOES NOT return a token. It just migrates.
        # Authenticaton happens via Firebase.
        
        print("Testing diagnosis endpoint (assuming auth might be needed, but checking for 404/500/etc)")
        res = await client.post("http://localhost:8000/api/diagnosis/analyze", json=payload)
        print(f"Status Code: {res.status_code}")
        print(f"Response: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_diagnosis_analyze())
