import requests
try:
    res = requests.get("http://127.0.0.1:5000/api/auth/crash")
    print("Status:", res.status_code)
    print("Body:", res.json())
except Exception as e:
    print(e)
