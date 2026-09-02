def test_transform_land_payload(client):
    raw_land = {
        "gtn": "101",
        "malak_name": "ABC Industries Pvt Ltd",
        "malak_pan": "ABCDE1234F",
        "kshetra": 4.5,
        "kshetra_unit": "HECTARES",
        "jamabandi": "APPROVED",
        "jamin_prakar": "INDUSTRIAL",
        "bandhak": False,
        "court_case": False,
        "district": "Pune",
        "taluka": "Khed",
        "village": "Chakan"
    }
    response = client.post("/api/canonical/transform", json={
        "department": "LAND",
        "raw_payload": raw_land,
        "requested_pan": "ABCDE1234F"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["organization_pan"] == "ABCDE1234F"
    assert data["organization_name"] == "ABC Industries Pvt Ltd"
    assert data["land_details"]["survey_number"] == "101"
    assert data["land_details"]["area"] == 4.5
    assert data["land_details"]["mutation_status"] == "APPROVED"
    assert data["land_details"]["ownership_status"] == "VALID"
    assert data["status"] == "RESOLVED"


def test_transform_electricity_payload(client):
    raw_elec = {
        "appl_no": "ELEC-2026-00101",
        "cust_name": "ABC Industries Pvt Ltd",
        "cust_pan": "ABCDE1234F",
        "load_req": "500",
        "load_sanc": "500",
        "cat_code": "HT-IND",
        "appl_stat": "APPROVED",
        "insp_stat": "COMPLETED",
        "meter_stat": "INSTALLED",
        "conn_stat": "ENERGIZED",
        "dues_flag": False
    }
    response = client.post("/api/canonical/transform", json={
        "department": "ELECTRICITY",
        "raw_payload": raw_elec,
        "requested_pan": "ABCDE1234F"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["organization_pan"] == "ABCDE1234F"
    assert data["industry_type"] == "INDUSTRIAL"
    assert data["electricity_details"]["requested_load_kw"] == 500.0
    assert data["electricity_details"]["sanctioned_load_kw"] == 500.0
    assert data["electricity_details"]["outstanding_dues"] is False
    assert data["status"] == "RESOLVED"


def test_transform_pollution_payload(client):
    raw_poll = {
        "application_no": "MPCB-8821",
        "application_project_id": "PROJ-101",
        "industry_name": "ABC Industries Pvt Ltd",
        "industry_pan": "ABCDE1234F",
        "consent_type": "CTE",
        "consent_status": "APPROVED",
        "compliance_status": "COMPLIANT",
        "region": "Pune",
        "plant_location": "MIDC Pune",
        "industry_type": "Chemical"
    }
    response = client.post("/api/canonical/transform", json={
        "department": "POLLUTION",
        "raw_payload": raw_poll,
        "requested_pan": "ABCDE1234F"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["organization_pan"] == "ABCDE1234F"
    assert data["pollution_details"]["consent_status"] == "APPROVED"
    assert data["pollution_details"]["compliance_status"] == "COMPLIANT"
    assert data["status"] == "RESOLVED"
