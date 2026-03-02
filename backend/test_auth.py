import requests

base_url = "http://localhost:8000/api"

try:
    print("Testing Signup...")
    signup_data = {
        "email": "test456@example.com",
        "password": "password123",
        "full_name": "Test User",
        "role": "patient"
    }
    res = requests.post(f"{base_url}/auth/signup", json=signup_data)
    print("Signup Status:", res.status_code)
    print("Signup Response:", res.json())

    print("\nTesting Login...")
    login_data = {
        "username": "test456@example.com",
        "password": "password123"
    }
    res2 = requests.post(f"{base_url}/auth/login", data=login_data)
    print("Login Status:", res2.status_code)
    try:
        print("Login Response:", res2.json())
    except:
        print("Login Response Text:", res2.text)

except Exception as e:
    print("Error:", e)
