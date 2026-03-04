import asyncio
import httpx

async def test_legacy_login():
    # Attempt legacy migration (what the frontend does on an auth/user-not-found)
    payload = {
        "email": "admin@hotel.com",
        "password": "admin123"
    }
    
    async with httpx.AsyncClient() as client:
        # Note: Depending on whether admin@hotel.com is actually legacy, this might succeed or fail.
        # But we are mainly testing if it throws a 422 Unprocessable Entity anymore.
        res = await client.post("http://localhost:8000/api/auth/migrate-legacy", json=payload)
        print(f"Status Code: {res.status_code}")
        print(f"Response: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_legacy_login())
