import httpx

url = "http://127.0.0.1:8000/api/reports/"
params = {
    "patient_id": "WR7FrYf37QpjRB4xAwkJ",
    "report_type": "summary"
}
try:
    with httpx.Client(timeout=30.0) as client:
        response = client.post(url, params=params)
        print(f"Status: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Error: {e}")
