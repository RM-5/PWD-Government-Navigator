import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["DATABASE_AUTO_CREATE"] = "true"
os.environ["DATABASE_AUTO_SEED_DEMO"] = "true"
os.environ["DATABASE_STARTUP_CHECK"] = "true"

from fastapi.testclient import TestClient

from app.main import app


def citizen_headers(client: TestClient) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": "citizen@demo.local"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_startup_creates_schema_and_seeds_demo_data():
    with TestClient(app) as client:
        headers = citizen_headers(client)

        assert client.get("/api/health/db").status_code == 200
        assert client.get("/api/auth/me", headers=headers).status_code == 200

        services = client.get("/api/services")
        assert services.status_code == 200
        assert any(service["name"] == "Disability Certificate and UDID Support" for service in services.json())


def test_citizen_can_create_case_and_book_seeded_slot():
    with TestClient(app) as client:
        headers = citizen_headers(client)

        hospital = client.get("/api/hospitals").json()[0]
        department = hospital["departments"][0]
        case_response = client.post("/api/cases", headers=headers, json={"assigned_hospital_id": hospital["id"]})
        assert case_response.status_code == 201

        slot_response = client.get(
            "/api/appointments/slots",
            params={"hospital_id": hospital["id"], "department_id": department["id"]},
        )
        assert slot_response.status_code == 200
        slot = next(slot for slot in slot_response.json() if slot["booked_count"] < slot["capacity"])

        appointment_response = client.post(
            "/api/appointments",
            headers=headers,
            json={
                "case_id": case_response.json()["id"],
                "hospital_id": hospital["id"],
                "department_id": department["id"],
                "appointment_date": slot["date"],
                "appointment_time": slot["start_time"],
                "booking_method": "mock_api",
            },
        )

        assert appointment_response.status_code == 201
        assert appointment_response.json()["status"] == "confirmed"
