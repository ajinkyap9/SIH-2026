const express = require('express');
const { requirePermission } = require('../middleware/auth');
const store = require('../data/store');
const { toCanonical, detectSchemaDrift } = require('../utils/schemaMapper');
const { evaluateLandDependency } = require('../utils/policyEngine');
const { auditMiddleware, getRecentTransactions } = require('../utils/audit');
const { shouldSimulateFailure, sendSimulatedOutage } = require('../utils/failureSimulator');

const router = express.Router();

/**
 * GET /api/land/all
 * Returns all land records loaded dynamically from PostgreSQL.
 */
router.get('/all', async (req, res) => {
  const all = await store.getAllRecords();
  res.json({ success: true, count: all.length, records: all });
});

/**
 * POST /api/land/apply
 * Submits a new land application and persists it to PostgreSQL.
 */
router.post('/apply', async (req, res) => {
  const { surveyNumber, pan, applicantName, district, taluka, village, area, certificateType } = req.body || {};
  if (!surveyNumber || !pan) {
    return res.status(400).json({ error: 'Bad Request', message: 'Both "surveyNumber" and "pan" are required.' });
  }

  const existing = await store.getRecord(surveyNumber);
  const status = existing ? existing.jamabandi : 'PENDING';

  const newRecord = {
    gtn: String(surveyNumber).trim(),
    malak_name: applicantName || (existing ? existing.malak_name : 'Applicant'),
    malak_pan: String(pan).trim().toUpperCase(),
    kshetra: area ? String(area) : (existing ? existing.kshetra : '5.0'),
    kshetra_unit: 'HA',
    jamabandi: status,
    jamin_prakar: 'INDUSTRIAL',
    bandhak: false,
    court_case: false,
    district: district || 'Pune',
    taluka: taluka || 'Haveli',
    village: village || 'Wagholi'
  };

  const saved = await store.saveRecord(newRecord);
  res.json({
    success: true,
    message: 'Land certificate application recorded successfully.',
    application_ref: `LND-MH-${saved.gtn}-${saved.jamabandi}`,
    record: saved
  });
});

/**
 * GET /api/land/records/:surveyNumber
 * Returns the raw, legacy-shaped record — from PostgreSQL by GTN or PAN.
 */
router.get(
  '/records/:surveyNumber',
  requirePermission('read:records'),
  auditMiddleware('GET /records/:surveyNumber', (req) => req.params.surveyNumber),
  async (req, res) => {
    const record = await store.getRecord(req.params.surveyNumber);

    if (shouldSimulateFailure(req, record)) return sendSimulatedOutage(res);

    if (!record) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No land record found for survey number or PAN "${req.params.surveyNumber}".`
      });
    }

    const { simulateOutage, ...cleanRecord } = record;
    const payload = req.query.schema === 'canonical' ? toCanonical(cleanRecord) : cleanRecord;
    res.json(payload);
  }
);

/**
 * GET /api/land/status/:surveyNumber
 * Lightweight mutation-status check, in canonical field names
 */
router.get(
  '/status/:surveyNumber',
  requirePermission('read:status'),
  auditMiddleware('GET /status/:surveyNumber', (req) => req.params.surveyNumber),
  async (req, res) => {
    const record = await store.getRecord(req.params.surveyNumber);

    if (shouldSimulateFailure(req, record)) return sendSimulatedOutage(res);

    if (!record) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No land record found for survey number ${req.params.surveyNumber}.`
      });
    }

    const { simulateOutage, ...cleanRecord } = record;
    const canonical = toCanonical(cleanRecord);
    res.json({
      survey_number: canonical.survey_number,
      mutation_status: canonical.mutation_status,
      encumbrance_free: canonical.encumbrance_free,
      dispute_free: canonical.dispute_free,
      last_updated: new Date().toISOString(),
      retryable: canonical.mutation_status === 'PENDING'
    });
  }
);

/**
 * POST /api/land/verify
 * Body: { surveyNumber, pan }
 */
router.post(
  '/verify',
  requirePermission('verify'),
  auditMiddleware('POST /verify', (req) => req.body && req.body.surveyNumber),
  async (req, res) => {
    const { surveyNumber, pan, applicantName, district, taluka, village, area } = req.body || {};

    if (!surveyNumber || !pan) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Both "surveyNumber" and "pan" are required in the request body.'
      });
    }

    let record = await store.getRecord(surveyNumber);

    if (shouldSimulateFailure(req, record)) return sendSimulatedOutage(res);

    // If record doesn't exist yet, register it dynamically for this applicant!
    if (!record) {
      record = await store.saveRecord({
        gtn: String(surveyNumber).trim(),
        malak_name: applicantName || 'Registered Applicant',
        malak_pan: String(pan).trim().toUpperCase(),
        kshetra: area ? String(area) : '5.0',
        kshetra_unit: 'HA',
        jamabandi: 'APPROVED',
        jamin_prakar: 'INDUSTRIAL',
        bandhak: false,
        court_case: false,
        district: district || 'Pune',
        taluka: taluka || 'Haveli',
        village: village || 'Wagholi'
      });
    }

    const { simulateOutage, ...cleanRecord } = record;
    const canonical = toCanonical(cleanRecord);
    const { checks, dependency_status } = evaluateLandDependency(canonical, pan);

    res.json({
      survey_number: canonical.survey_number,
      canonical,
      checks,
      dependency_status
    });
  }
);

/**
 * PATCH /api/land/records/:surveyNumber/mutation
 */
router.patch(
  '/records/:surveyNumber/mutation',
  requirePermission('admin:mutation'),
  auditMiddleware('PATCH /records/:surveyNumber/mutation', (req) => req.params.surveyNumber),
  async (req, res) => {
    const { mutation_status } = req.body || {};

    if (!mutation_status || !store.VALID_MUTATION_STATUSES.includes(mutation_status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `"mutation_status" must be one of: ${store.VALID_MUTATION_STATUSES.join(', ')}.`
      });
    }

    const updated = await store.updateMutationStatus(req.params.surveyNumber, mutation_status);

    if (!updated) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No land record found for survey number ${req.params.surveyNumber}.`
      });
    }

    res.json({
      survey_number: updated.gtn,
      mutation_status: updated.jamabandi,
      note: 'Persisted to PostgreSQL database and live store.'
    });
  }
);

/**
 * POST /api/land/schema-mapping/detect
 * Body: an arbitrary JSON object shaped like a (possibly drifted)
 * departmental record. Returns mapping suggestions with confidence
 * scores, never a silent auto-correction (Section 11 / 23).
 */
router.post(
  '/schema-mapping/detect',
  requirePermission('detect:schema-drift'),
  auditMiddleware('POST /schema-mapping/detect', () => null),
  (req, res) => {
    const payload = req.body || {};
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provide a JSON body representing the record to check for schema drift.'
      });
    }
    res.json(detectSchemaDrift(payload));
  }
);

/**
 * GET /api/land/audit
 * Recent transaction log — restricted to the interoperability
 * platform's own credentials, per Section 13.
 */
router.get('/audit', requirePermission('read:audit'), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  res.json({ transactions: getRecentTransactions(limit) });
});

module.exports = router;
