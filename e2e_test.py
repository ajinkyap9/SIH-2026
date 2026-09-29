"""
End-to-end verification sequence:
  1. Register a citizen on the portal (gateway)
  2. Login (request OTP) via the portal
  3. Verify OTP
  4. Quick-decision via interop_backend
  5. Login to interop_backend (ensureInteropAuth equivalent)
  6. Submit verify-plant on interop_backend

Each step is checked; the run ends with an N/6 summary and exits non-zero if
any step failed. Every run registers a fresh citizen (unique PAN, Aadhaar,
mobile and email), so the sequence can be repeated against the same database.

Addresses: PORTAL_URL / INTEROP_BACKEND_URL environment variables if set
(e.g. a deployed setup), else the repo-root ports.json (local development).
"""
import json
import os
import pathlib
import random
import string
import sys

import requests

_P = json.loads((pathlib.Path(__file__).resolve().parent / "ports.json").read_text(encoding="utf-8"))
GW = (os.environ.get("PORTAL_URL") or f"http://{_P['host']}:{_P['services']['portal']['port']}").rstrip("/")
INTEROP = (os.environ.get("INTEROP_BACKEND_URL") or f"http://{_P['host']}:{_P['services']['interop']['port']}").rstrip("/")

# A fresh, valid identity for this run.
_rng = random.SystemRandom()
PAN = "".join(_rng.choice(string.ascii_uppercase) for _ in range(5)) + f"{_rng.randint(0, 9999):04d}" + _rng.choice(string.ascii_uppercase)
AADHAAR = str(_rng.randint(2, 9)) + "".join(str(_rng.randint(0, 9)) for _ in range(11))
MOBILE = str(_rng.randint(6, 9)) + "".join(str(_rng.randint(0, 9)) for _ in range(9))
EMAIL = f"e2e.{PAN.lower()}@test.gov.in"
PASSWORD = "E2e-Test-Pass-1"

results = []


def step(n, label):
    print(f"\n{'='*60}")
    print(f"STEP {n}: {label}")
    print(f"{'='*60}")


def record(n, ok, detail):
    results.append((n, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}: {detail}")


def body(r):
    try:
        return r.json()
    except ValueError:
        return {"raw": r.text[:300]}


print(f"Portal:  {GW}\nInterop: {INTEROP}\nTest citizen: PAN {PAN}, Aadhaar {AADHAAR}, mobile {MOBILE}")

# ── STEP 1: Register Citizen ──
step(1, "Register citizen on the portal (POST /api/auth/register)")
r = requests.post(f"{GW}/api/auth/register", json={
    "accountType": "individual",
    "firstName": "E2E",
    "lastName": "TestUser",
    "aadhaar": AADHAAR,
    "pan": PAN,
    "mobile": MOBILE,
    "email": EMAIL,
    "password": PASSWORD,
}, timeout=30)
d1 = body(r)
print(f"  HTTP {r.status_code}")
print(f"  Body: {json.dumps(d1)[:500]}")
record(1, r.status_code == 200 and d1.get("success") is True, f"HTTP {r.status_code} — {d1.get('message')}")

# ── STEP 2: Login (request OTP) ──
step(2, "Login (request OTP) via portal POST /api/auth/login")
r = requests.post(f"{GW}/api/auth/login", json={
    "identifierType": "aadhaar",
    "identifierValue": AADHAAR,
}, timeout=30)
d2 = body(r)
print(f"  HTTP {r.status_code}")
print(f"  Body: {json.dumps(d2, indent=2)}")
txn_id_otp = d2.get("txnId", "")
record(2, r.status_code == 200 and bool(txn_id_otp), f"HTTP {r.status_code} — OTP transaction {txn_id_otp or 'missing'}")

# ── STEP 3: Verify OTP (demo OTP is 654321) ──
step(3, "Verify OTP (demo code 654321)")
r = requests.post(f"{GW}/api/auth/verify-otp", json={
    "txnId": txn_id_otp,
    "otp": "654321",
}, timeout=30)
d3 = body(r)
print(f"  HTTP {r.status_code}")
print(f"  Body: {json.dumps(d3, indent=2)}")
gw_token = d3.get("token", "")
same_person = (d3.get("citizen") or {}).get("pan", "").upper() == PAN
record(3, r.status_code == 200 and bool(gw_token) and same_person,
       f"HTTP {r.status_code} — session token {'issued' if gw_token else 'missing'} for {(d3.get('citizen') or {}).get('pan', '?')}")

# ── STEP 4: Quick Decision via interop_backend ──
step(4, f"Quick Decision (interop_backend {INTEROP})")
r = requests.post(f"{INTEROP}/api/interview/quick-decision", json={
    "project_type": "MANUFACTURING",
    "industry_type": "CHEMICAL",
    "location": {"district": "Pune", "state": "Maharashtra"},
    "land": {"required": True, "owned": True, "area_hectare": 4.5},
    "electricity": {"required": True, "required_load_kw": 500},
    "environment": {"industrial_emissions": True, "hazardous_waste": False},
}, timeout=30)
d4 = body(r)
print(f"  HTTP {r.status_code}")
print(f"  Body: {json.dumps(d4, indent=2)}")
required_services = d4.get("required_services", [])
record(4, r.status_code == 200 and set(required_services) == {"LAND_SERVICE", "ELECTRICITY_SERVICE", "POLLUTION_SERVICE"},
       f"HTTP {r.status_code} — required services {required_services}")

# ── STEP 5: Login to interop_backend (ensureInteropAuth equivalent) ──
step(5, "Login to interop_backend as ABC Industries (applicant@abcindustries.com)")
r = requests.post(f"{INTEROP}/api/auth/login", json={
    "email": "applicant@abcindustries.com",
    "password": "SecretPass123",
}, timeout=30)
d5 = body(r)
print(f"  HTTP {r.status_code}")
print(f"  Body: {json.dumps(d5, indent=2)}")
interop_jwt = d5.get("access_token", "")
record(5, r.status_code == 200 and bool(interop_jwt), f"HTTP {r.status_code} — JWT {'issued' if interop_jwt else 'missing'}")

# ── STEP 6: Submit verify-plant on interop_backend ──
step(6, "Submit verify-plant (POST /api/projects/verify-plant)")
r = requests.post(f"{INTEROP}/api/projects/verify-plant", json={
    "project_name": "Chemical Manufacturing Unit",
    "organization_pan": "ABCDE1234F",
    "industry_type": "Chemical",
    "location_district": "Pune",
    "land_survey_number": "101",
    "electricity_application_number": "ELEC-2026-00101",
    "pollution_application_number": "MPCB-8821",
    "required_services": ["LAND_SERVICE", "ELECTRICITY_SERVICE", "POLLUTION_SERVICE"],
}, headers={
    "Authorization": f"Bearer {interop_jwt}",
}, timeout=60)
d6 = body(r)
print(f"  HTTP {r.status_code}")
print(f"  Body: {json.dumps(d6, indent=2)}")
txn_id = d6.get("transaction_id", "NOT FOUND")
checks = {c.get("department"): c.get("status") for c in d6.get("department_checks", [])}
record(6, r.status_code == 200 and txn_id.startswith("TXN-") and d6.get("overall_clearance_status") in {"RESOLVED", "WAITING", "ACTION_REQUIRED"}
       and all(checks.get(dep) == "SUCCESS" for dep in ("LAND", "ELECTRICITY", "POLLUTION")),
       f"HTTP {r.status_code} — {txn_id}, overall {d6.get('overall_clearance_status')}, departments {checks}")

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{'='*60}")
print(f"E2E SEQUENCE: {passed}/{len(results)} steps passed")
for n, ok, detail in results:
    print(f"  {'PASS' if ok else 'FAIL'}  step {n}: {detail}")
print(f"{'='*60}")
sys.exit(0 if passed == len(results) else 1)
