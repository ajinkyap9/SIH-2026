def test_user_registration(client):
    payload = {
        "email": "newuser@testcorp.com",
        "password": "Password123",
        "organization_name": "Test Corp Ltd",
        "organization_pan": "TESTP1234T",
        "role": "APPLICANT"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@testcorp.com"
    assert data["organization_pan"] == "TESTP1234T"


def test_user_login_success(client):
    payload = {
        "email": "applicant@abcindustries.com",
        "password": "SecretPass123"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["organization_pan"] == "ABCDE1234F"


def test_user_login_wrong_password(client):
    payload = {
        "email": "applicant@abcindustries.com",
        "password": "WrongPassword999"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401


def test_profile_endpoint(client, abc_headers):
    response = client.get("/api/auth/me", headers=abc_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "applicant@abcindustries.com"
    assert data["organization_pan"] == "ABCDE1234F"
