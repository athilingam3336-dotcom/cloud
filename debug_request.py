import requests

payload = {
    "first_name": "Test",
    "last_name": "User",
    "email": "test@example.com",
    "phone": "",
    "password": "Password@123"
}

resp = requests.post("http://127.0.0.1:8000/api/auth/register", json=payload)
print(resp.status_code)
print(resp.json())
