# SIH26129 Government Interoperability Platform — Complete Execution & Integration Plan

> **Note for Teammates & AI Agents**: This document provides a complete technical specification, architectural mapping, data structures, and step-by-step instructions to integrate the backend, adapters, and database with the existing static frontend.

---

## 1. Problem Statement (SIH26129)

Different government departments operate with contrasting data structures, field naming conventions, database schemas, and API protocols. Directly connecting every department to every other department creates an $O(N^2)$ integration nightmare.

Our platform is a **Centralized Interoperability & Workflow Orchestration Gateway** sitting between Company Plant Establishment applications and departmental APIs.

```
                 COMPANY APPLICATION (ABC Industries)
                                │
                                ▼
                   INTEROPERABILITY GATEWAY (Backend)
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   LAND / REVENUE           ELECTRICITY             POLLUTION
      API                     API                     API
```

---

## 2. Real-World Use Case (Plant Establishment)

A company (e.g., `ABC Industries`, Org ID `ORG101`) submits a single-window application to establish an industrial plant. To verify the project, data must be fetched and coordinated across three heterogeneous departmental systems:

1. **Land / Revenue API**: Verifies land survey numbers, hectares, and mutation status.
2. **Electricity Discom API**: Verifies consumer ID, sanctioned load (kW), and active connection status.
3. **Pollution / Environment API**: Verifies MPCB application number, industry type (Chemical/Orange/Green), CTE consent status, and validity period.

---

## 3. Departmental API Specifications & Schema Heterogeneity

### API 1: Land / Revenue (`GET /land/{survey_no}`)
- **Sample Input**: `survey_no = "S-102"`
- **Response**:
  ```json
  {
    "survey_no": "S-102",
    "owner_name": "ABC Industries",
    "area_hectare": 12.5,
    "district": "Pune",
    "land_type": "Industrial",
    "mutation_status": "APPROVED"
  }
  ```

### API 2: Electricity Discom (`GET /electricity/{consumer_id}`)
- **Sample Input**: `consumer_id = "MSD10291"`
- **Response**:
  ```json
  {
    "consumer_id": "MSD10291",
    "registered_name": "ABC Industries",
    "sanctioned_load": 500,
    "connected_load": 420,
    "connection_status": "ACTIVE"
  }
  ```

### API 3: Pollution Control (`GET /pollution/{application_id}`)
- **Sample Input**: `application_no = "MPCB-8821"`
- **Response**:
  ```json
  {
    "application_no": "MPCB-8821",
    "industry_name": "ABC Industries",
    "industry_type": "CHEMICAL",
    "consent_type": "CTE",
    "consent_status": "APPROVED",
    "valid_until": "2027-03-31"
  }
  ```

---

## 4. Canonical Data Model (Normalized Gateway Payload)

The transformation engine maps contrasting field names (`owner_name` / `registered_name` / `industry_name`) into a single standardized Canonical Data Model:

```json
{
  "transaction_id": "TXN-1001",
  "organization_id": "ORG101",
  "organization_name": "ABC Industries",
  "verification_status": "SUCCESS",
  "land": {
    "survey_number": "S-102",
    "area_hectares": 12.5,
    "district": "Pune",
    "mutation_status": "APPROVED"
  },
  "electricity": {
    "consumer_id": "MSD10291",
    "sanctioned_load_kw": 500,
    "connection_status": "ACTIVE"
  },
  "environment": {
    "application_number": "MPCB-8821",
    "consent_type": "CTE",
    "consent_status": "APPROVED",
    "valid_until": "2027-03-31"
  },
  "audit": {
    "timestamp": "2026-09-02T23:20:00Z",
    "consent_verified": true,
    "execution_time_ms": 140
  }
}
```

---

## 5. Platform Architecture & Backend Responsibilities

```
                                 FRONTEND
                                    │
                                    ▼
                          AUTHENTICATION & JWT
                                    │
                                    ▼
                         SECURITY & CONSENT GATE
                                    │
                                    ▼
                        WORKFLOW ORCHESTRATOR
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
   LAND ADAPTER             ELECTRICITY ADAPTER        POLLUTION ADAPTER
         │                          │                          │
         ▼                          ▼                          ▼
   Land API (GET)           Electricity API (GET)      Pollution API (GET)
         └──────────────────────────┬──────────────────────────┘
                                    ▼
                          TRANSFORMATION ENGINE
                                    │
                                    ▼
                          CANONICAL MODEL OUTPUT
                                    │
                                    ▼
                     DATABASE (Platform Metadata & Audit)
```

### Core Backend Modules & Interfaces:

1. **Authentication / JWT**: Validates enterprise token (`JWT_BEARER_ORG101_...`).
2. **Consent Engine**: Checks user consent for `Land`, `Electricity`, and `Pollution` before issuing requests.
3. **Department Adapters**:
   - `LandAdapter.fetchAndTransform(surveyNo)`
   - `ElectricityAdapter.fetchAndTransform(consumerId)`
   - `PollutionAdapter.fetchAndTransform(mpcbAppNo)`
4. **Transformation Engine**: Normalizes field names, formats dates (`31/03/2027` $\rightarrow$ `2027-03-31`), coerces types, and maps enums.
5. **AI Schema Drift Detector**:
   - Compares incoming department payloads against the registered schema.
   - Detects drift (e.g. `sanctioned_load` renamed to `approved_load`).
   - Generates confidence scores (e.g., `approved_load` $\rightarrow$ `sanctioned_load_kw`, Confidence 96%) for admin review.
6. **Resilience & Circuit Breaker**:
   - Wraps department API calls in circuit breaker instances.
   - Tracks consecutive failures (e.g. 3 timeouts $\rightarrow$ Circuit OPEN).
   - Gracefully returns partial success data if one department is down.
7. **Platform Database (PostgreSQL / SQLite)**:
   - Stores platform metadata, schema mappings, active consent records, and immutable transaction audit logs.

---

## 6. Frontend Structure (`server/public/`)

The static frontend is fully structured and hosted at `http://localhost:5000`:

| File | Purpose | Key Features |
|---|---|---|
| [`index.html`](file:///e:/SIH_2026/SIH-2026/server/public/index.html) | Public Landing Page | Explains SIH26129 problem, 3 department APIs, architecture |
| [`login.html`](file:///e:/SIH_2026/SIH-2026/server/public/login.html) | Enterprise Login | JWT token generator for companies |
| [`register.html`](file:///e:/SIH_2026/SIH-2026/server/public/register.html) | Company Onboarding | CIN verification and Org ID registration |
| [`dashboard.html`](file:///e:/SIH_2026/SIH-2026/server/public/dashboard.html) | Main Dashboard | 4 Interactive Views: Plant Verification Flow, Schema Registry & AI Drift, Resilience Sandbox, Audit Logs |
| [`css/gov-style.css`](file:///e:/SIH_2026/SIH-2026/server/public/css/gov-style.css) | Styling System | Visual pipeline cards, code blocks, mapping arrows, badges |

---

## 7. Instructions for Teammate / Next Agent

To connect your backend code to this frontend:

1. **Keep `server/public/` intact**: The UI is designed to render raw API responses, transformation mapping steps, canonical outputs, and AI drift suggestions seamlessly.
2. **Mount Endpoints in `server/src/routes/interopRoutes.js`**:
   - `POST /api/interop/verify-plant`: Accepts `{ orgId, companyName, surveyNo, consumerId, mpcbAppNo, consent }`, executes backend adapters, and returns the Canonical JSON object.
   - `GET /api/interop/schema-mappings`: Returns active transformation rules.
   - `POST /api/interop/approve-drift`: Persists AI-suggested schema drift mappings.
   - `GET /api/interop/audit-logs`: Returns transaction audit history.
3. **Run Server**:
   ```bash
   cd server && npm start
   ```
   Access `http://localhost:5000/dashboard.html` to test the integrated workflow.
