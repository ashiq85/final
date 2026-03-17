import httpx

url = "http://127.0.0.1:8000/api/reports/"
params = {
    "patient_id": "WR7FrYf37QpjRB4xAwkJ",
    "report_type": "summary"
}
# We don't have a valid token here easily, but we can see if it returns 401 or crashes.
try:
    response = httpx.post(url, params=params)
    print(f"Status: {response.status_code}")
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
