import requests
import sys

BASE_URL = "http://127.0.0.1:5000/api/auth"

def run_tests():
    print("1. Signup user")
    res = requests.post(f"{BASE_URL}/signup", json={
        "email": "test@example.com",
        "password": "password123",
        "name": "Test User"
    })
    
    if res.status_code == 400 and res.json().get("code") == "EMAIL_EXISTS":
        print("User already exists, proceeding to login...")
    else:
        assert res.status_code == 200, f"Signup failed: {res.text}"
        print("Signup OK!")

    print("2. Login user")
    res = requests.post(f"{BASE_URL}/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    print("Login OK!")

    print("3. Login with wrong password")
    res = requests.post(f"{BASE_URL}/login", json={
        "email": "test@example.com",
        "password": "wrongpassword"
    })
    assert res.status_code == 401, "Should be 401"
    assert res.json()["code"] == "UNAUTHORIZED"
    print("Wrong password rejected properly.")

    print("4. Get ME endpoint")
    res = requests.get(f"{BASE_URL}/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200, f"ME failed: {res.text}"
    user = res.json()
    assert user["email"] == "test@example.com"
    assert "password_hash" not in user
    print("ME OK!")

    print("5. Get ME without token")
    res = requests.get(f"{BASE_URL}/me")
    assert res.status_code == 401
    assert res.json()["code"] == "UNAUTHORIZED"
    print("Protected endpoint rejected missing token properly.")

    print("All tests passed!")

if __name__ == "__main__":
    run_tests()
