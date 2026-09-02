def test_schema_drift_detection(client):
    payload = {
        "department_code": "ELECTRICITY",
        "sample_payload": {
            "application_no": "ELEC-2026-00101",
            "approved_load": "500",  # Mutated field
            "power_status": "ENERGIZED"  # Mutated field
        }
    }
    response = client.post("/api/schema/detect", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["has_drift"] is True
    assert "approved_load" in data["unmapped_fields"]
    assert len(data["suggestions"]) > 0
    sug = next(s for s in data["suggestions"] if s["detected_field"] == "approved_load")
    assert sug["suggested_canonical_field"] == "sanctioned_load_kw"
    assert sug["confidence_score"] >= 0.70


def test_schema_drift_approval_by_admin(client, admin_headers):
    payload = {
        "department_code": "ELECTRICITY",
        "source_field": "approved_load",
        "target_canonical_field": "sanctioned_load_kw"
    }
    response = client.post("/api/schema/approve-drift", json=payload, headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
