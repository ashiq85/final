import asyncio
import httpx
import uuid

async def test_signup():
    test_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": test_email,
        "password": "testpassword123",
        "full_name": "Test User",
        "role": "patient"
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post("http://localhost:8000/api/auth/signup", json=payload)
        print(f"Status Code: {res.status_code}")
        print(f"Response: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_signup())
