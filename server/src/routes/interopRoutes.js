import express from 'express';
import { db } from '../db/seedData.js';

const router = express.Router();

// Helper: Canonicalizer function for Citizen Land Records
export function normalizeLandSchema(rawLandData) {
  if (!rawLandData) return null;

  const surveyNumber = rawLandData.gtn || rawLandData.survey_no || rawLandData.surveyNumber;
  const ownerName = rawLandData.malak_name || rawLandData.owner_name || rawLandData.owner;
  const ownerPan = rawLandData.malak_pan || rawLandData.pan || rawLandData.ownerPAN;
  const ownerAadhaar = rawLandData.malak_aadhaar || rawLandData.aadhaar;
  const areaHectares = parseFloat(rawLandData.kshetra || rawLandData.area || 0);
  const mutationStatus = rawLandData.jamabandi || rawLandData.mutation_status || rawLandData.mutationStatus;
  const landCategory = rawLandData.jamin_prakar || rawLandData.land_type || rawLandData.landCategory;
  const isEncumbered = rawLandData.bandhak !== undefined ? Boolean(rawLandData.bandhak) : Boolean(rawLandData.encumbered);
  const hasCourtCase = rawLandData.court_case !== undefined ? Boolean(rawLandData.court_case) : Boolean(rawLandData.hasCourtDispute);

  return {
    survey_number: String(surveyNumber),
    citizen_name: ownerName,
    citizen_pan: ownerPan,
    citizen_aadhaar: ownerAadhaar,
    area_hectares: areaHectares,
    area_unit: 'HA',
    mutation_status: mutationStatus, // APPROVED, PENDING, UNDER_OBJECTION
    land_category: landCategory, // AGRICULTURAL, RESIDENTIAL, COMMERCIAL
    encumbrance_status: isEncumbered ? 'ENCUMBERED' : 'CLEAR',
    has_court_case: hasCourtCase,
    district: rawLandData.jilha || 'Pune',
    taluka: rawLandData.taluka || 'Haveli',
    village: rawLandData.gaw || 'N/A',
    normalized_at: new Date().toISOString()
  };
}

// POST /api/interop/evaluate-project - G2C Citizen Prerequisites Evaluation Engine
router.post('/evaluate-project', (req, res) => {
  const { applicantPan, applicantAadhaar, surveyNumber } = req.body;

  if (!surveyNumber) {
    return res.status(400).json({ success: false, message: 'Survey Number required for evaluation' });
  }

  const rawLand = db.landRecords[surveyNumber];

  if (!rawLand) {
    return res.status(404).json({
      success: false,
      message: `Land Record for Survey #${surveyNumber} could not be retrieved from Land Department API`
    });
  }

  // 1. Canonical transformation
  const canonicalLand = normalizeLandSchema(rawLand);

  // 2. Policy Engine Verification (by Aadhaar or PAN match)
  const panMatch = applicantPan ? (canonicalLand.citizen_pan === applicantPan.toUpperCase()) : true;
  const aadhaarMatch = applicantAadhaar ? (canonicalLand.citizen_aadhaar === applicantAadhaar.replace(/[\s-]/g, '')) : true;
  const identityMatch = panMatch && aadhaarMatch;

  const mutationApproved = canonicalLand.mutation_status === 'APPROVED';
  const isClearEncumbrance = canonicalLand.encumbrance_status === 'CLEAR';
  const noLegalDispute = !canonicalLand.has_court_case;

  const landDependencyResolved = identityMatch && mutationApproved && isClearEncumbrance && noLegalDispute;

  // Determine dependency state
  let dependencyStatus = 'RESOLVED';
  let pendingReason = null;

  if (!identityMatch) {
    dependencyStatus = 'FAILED';
    pendingReason = `Identity mismatch: Authenticated Citizen credentials do not match Land Ownership Record.`;
  } else if (canonicalLand.mutation_status === 'PENDING') {
    dependencyStatus = 'WAITING';
    pendingReason = 'Land Mutation (7/12 Jamabandi) is PENDING at Tahsildar / Revenue Department.';
  } else if (canonicalLand.mutation_status === 'UNDER_OBJECTION') {
    dependencyStatus = 'ACTION_REQUIRED';
    pendingReason = 'Land Record is UNDER OBJECTION due to pending mutation query at Sub-Registrar.';
  } else if (!isClearEncumbrance) {
    dependencyStatus = 'ACTION_REQUIRED';
    pendingReason = 'Active bank encumbrance flag present on land record (Bandhak = true). NOC required.';
  } else if (canonicalLand.has_court_case) {
    dependencyStatus = 'BLOCKED';
    pendingReason = 'Land record has an active civil court dispute flag.';
  }

  // 3. G2C Citizen Workflow Dependency Tree
  const workflowState = {
    applicationId: `G2C-MH-2026-${surveyNumber}`,
    surveyNumber,
    lastEvaluatedAt: new Date().toISOString(),
    overallStatus: landDependencyResolved ? 'READY_FOR_CITIZEN_SCHEME' : 'DEPENDENCY_WAITING',
    dependencies: [
      {
        id: 'DEP-LAND-01',
        title: 'Land Ownership & 7/12 Jamabandi Verification',
        department: 'Land Revenue & Settlement Department',
        status: dependencyStatus,
        reason: pendingReason,
        lastChecked: new Date().toISOString(),
        details: canonicalLand
      },
      {
        id: 'DEP-AGRI-02',
        title: 'DBT Farmer Subsidy / Agricultural Approval',
        department: 'Department of Agriculture, Govt. of Maharashtra',
        status: landDependencyResolved ? 'IN_PROGRESS' : 'WAITING_FOR_PREREQUISITE',
        reason: landDependencyResolved ? 'Land Verification satisfied. Application sent for sanction.' : 'Blocked: Waiting for Land Verification = RESOLVED',
        lastChecked: new Date().toISOString()
      },
      {
        id: 'DEP-ELEC-03',
        title: 'Agri-Pump Electricity Meter Connection',
        department: 'MSEDCL / Mahavitaran',
        status: landDependencyResolved ? 'IN_PROGRESS' : 'WAITING_FOR_PREREQUISITE',
        reason: landDependencyResolved ? 'Prerequisite Land Ownership verified.' : 'Blocked: Waiting for Land Verification = RESOLVED',
        lastChecked: new Date().toISOString()
      }
    ]
  };

  db.auditLogs.push({
    id: `AUD-G2C-${Date.now()}`,
    timestamp: new Date().toISOString(),
    event: 'CITIZEN_DEPENDENCY_EVALUATED',
    surveyNumber,
    status: dependencyStatus
  });

  res.json({
    success: true,
    workflow: workflowState,
    rawLegacyPayload: rawLand,
    canonicalModel: canonicalLand
  });
});

// GET /api/interop/audit-logs
router.get('/audit-logs', (req, res) => {
  res.json({
    success: true,
    totalLogs: db.auditLogs.length,
    logs: db.auditLogs.slice().reverse()
  });
});

export default router;
