import express from 'express';
import { db } from '../db/seedData.js';

const router = express.Router();

// Helper: Canonicalizer function for Land Records
export function normalizeLandSchema(rawLandData) {
  if (!rawLandData) return null;

  // Handles standard legacy fields or shifted/drifted field names
  const surveyNumber = rawLandData.gtn || rawLandData.survey_no || rawLandData.surveyNumber;
  const ownerName = rawLandData.malak_name || rawLandData.owner_name || rawLandData.owner;
  const ownerPan = rawLandData.malak_pan || rawLandData.pan || rawLandData.ownerPAN;
  const areaHectares = parseFloat(rawLandData.kshetra || rawLandData.area || 0);
  const mutationStatus = rawLandData.jamabandi || rawLandData.mutation_status || rawLandData.mutationStatus;
  const landCategory = rawLandData.jamin_prakar || rawLandData.land_type || rawLandData.landCategory;
  const isEncumbered = rawLandData.bandhak !== undefined ? Boolean(rawLandData.bandhak) : Boolean(rawLandData.encumbered);
  const hasCourtCase = rawLandData.court_case !== undefined ? Boolean(rawLandData.court_case) : Boolean(rawLandData.hasCourtDispute);

  return {
    survey_number: String(surveyNumber),
    owner_name: ownerName,
    organization_pan: ownerPan,
    area_hectares: areaHectares,
    area_unit: 'HA',
    mutation_status: mutationStatus, // APPROVED, PENDING, REJECTED
    land_category: landCategory, // INDUSTRIAL, AGRICULTURAL, etc.
    encumbrance_status: isEncumbered ? 'ENCUMBERED' : 'CLEAR',
    has_court_case: hasCourtCase,
    district: rawLandData.jilha || 'Pune',
    taluka: rawLandData.taluka || 'Haveli',
    village: rawLandData.gaw || 'N/A',
    normalized_at: new Date().toISOString()
  };
}

// POST /api/interop/evaluate-project - Main Interoperability & Dependency Resolution Engine
router.post('/evaluate-project', (req, res) => {
  const { applicantPan, surveyNumber } = req.body;

  if (!applicantPan || !surveyNumber) {
    return res.status(400).json({ success: false, message: 'Applicant PAN and Survey Number required' });
  }

  const rawLand = db.landRecords[surveyNumber];

  if (!rawLand) {
    return res.status(404).json({
      success: false,
      message: `Land Record for Survey #${surveyNumber} could not be retrieved from Land Department API`
    });
  }

  // 1. Transform legacy payload to Canonical Model
  const canonicalLand = normalizeLandSchema(rawLand);

  // 2. Policy Engine Rules Evaluation
  const panMatch = canonicalLand.organization_pan === applicantPan.toUpperCase();
  const mutationApproved = canonicalLand.mutation_status === 'APPROVED';
  const isIndustrial = canonicalLand.land_category === 'INDUSTRIAL';
  const isClearEncumbrance = canonicalLand.encumbrance_status === 'CLEAR';
  const noLegalDispute = !canonicalLand.has_court_case;

  const landDependencyResolved = panMatch && mutationApproved && isIndustrial && isClearEncumbrance && noLegalDispute;

  // Determine dependency state & clear explanations
  let dependencyStatus = 'RESOLVED';
  let pendingReason = null;

  if (!panMatch) {
    dependencyStatus = 'FAILED';
    pendingReason = `PAN mismatch: Application PAN (${applicantPan}) does not match Land Ownership PAN (${canonicalLand.organization_pan})`;
  } else if (canonicalLand.mutation_status === 'PENDING') {
    dependencyStatus = 'WAITING';
    pendingReason = 'Land Department mutation status is still PENDING (Jamabandi in progress)';
  } else if (!isIndustrial) {
    dependencyStatus = 'ACTION_REQUIRED';
    pendingReason = `Land category is ${canonicalLand.land_category}. Non-agricultural/Industrial land conversion certificate required.`;
  } else if (!isClearEncumbrance) {
    dependencyStatus = 'ACTION_REQUIRED';
    pendingReason = 'Land has an active encumbrance/mortgage flag (Bandhak = true)';
  } else if (canonicalLand.has_court_case) {
    dependencyStatus = 'BLOCKED';
    pendingReason = 'Land record has an active court case dispute flag';
  }

  // 3. Project Workflow Dependency Tree
  const workflowState = {
    projectId: `PRJ-MH-2026-${surveyNumber}`,
    surveyNumber,
    applicantPan,
    lastEvaluatedAt: new Date().toISOString(),
    overallStatus: landDependencyResolved ? 'READY_FOR_MPCB_CONSENT' : 'DEPENDENCY_WAITING',
    dependencies: [
      {
        id: 'DEP-LAND-01',
        title: 'Land Ownership & Land-Use Verification',
        department: 'Land Records Department',
        status: dependencyStatus,
        reason: pendingReason,
        lastChecked: new Date().toISOString(),
        details: canonicalLand
      },
      {
        id: 'DEP-MPCB-02',
        title: 'MPCB Environmental Consent to Establish',
        department: 'Maharashtra Pollution Control Board',
        status: landDependencyResolved ? 'IN_PROGRESS' : 'WAITING_FOR_PREREQUISITE',
        reason: landDependencyResolved ? 'Prerequisite Land Verification satisfied. Ready for submission.' : 'Blocked: Waiting for Land Verification = RESOLVED',
        lastChecked: new Date().toISOString()
      },
      {
        id: 'DEP-ELEC-03',
        title: 'High-Tension Electricity Power Allocation',
        department: 'MSEDCL / Electricity Discom',
        status: landDependencyResolved ? 'IN_PROGRESS' : 'WAITING_FOR_PREREQUISITE',
        reason: landDependencyResolved ? 'Prerequisite Land Verification satisfied.' : 'Blocked: Waiting for Land Verification = RESOLVED',
        lastChecked: new Date().toISOString()
      }
    ]
  };

  db.auditLogs.push({
    id: `AUD-ENGINE-${Date.now()}`,
    timestamp: new Date().toISOString(),
    event: 'DEPENDENCY_EVALUATED',
    surveyNumber,
    landDependencyStatus: dependencyStatus
  });

  res.json({
    success: true,
    workflow: workflowState,
    rawLegacyPayload: rawLand,
    canonicalModel: canonicalLand
  });
});

// GET /api/interop/detect-drift - Schema Drift Detection Demo Endpoint
router.post('/detect-drift', (req, res) => {
  const { samplePayload } = req.body;
  const defaultExpected = ['gtn', 'malak_name', 'malak_pan', 'kshetra', 'jamabandi', 'jamin_prakar'];

  const incomingKeys = Object.keys(samplePayload || {});
  const missingKeys = defaultExpected.filter(k => !incomingKeys.includes(k));

  const mappingSuggestions = [];
  if (missingKeys.includes('malak_name') && incomingKeys.includes('owner_name')) {
    mappingSuggestions.push({
      original: 'malak_name',
      detected: 'owner_name',
      confidence: '96%',
      suggestedCanonical: 'owner_name'
    });
  }
  if (missingKeys.includes('jamabandi') && incomingKeys.includes('mutation_status')) {
    mappingSuggestions.push({
      original: 'jamabandi',
      detected: 'mutation_status',
      confidence: '98%',
      suggestedCanonical: 'mutation_status'
    });
  }

  res.json({
    driftDetected: missingKeys.length > 0,
    missingExpectedFields: missingKeys,
    detectedNewFields: incomingKeys.filter(k => !defaultExpected.includes(k)),
    mappingSuggestions
  });
});

// GET /api/interop/audit-logs - View cross-department audit trail
router.get('/audit-logs', (req, res) => {
  res.json({
    success: true,
    totalLogs: db.auditLogs.length,
    logs: db.auditLogs.slice().reverse()
  });
});

export default router;
