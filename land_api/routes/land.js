const express = require('express');
const { requirePermission } = require('../middleware/auth');
const store = require('../data/store');
const { toCanonical, detectSchemaDrift } = require('../utils/schemaMapper');
const { evaluateLandDependency } = require('../utils/policyEngine');
const { auditMiddleware, getRecentTransactions } = require('../utils/audit');
const { shouldSimulateFailure, sendSimulatedOutage } = require('../utils/failureSimulator');

const router = express.Router();

/**
 * GET /api/land/records/:surveyNumber
 * Returns the raw, legacy-shaped record — the department's native
 * schema (gtn, malak_name, jamabandi, ...). Add ?schema=canonical
 * to see it post-normalization, the way the interoperability layer
 * would consume it.
 */
router.get(
  '/records/:surveyNumber',
  requirePermission('read:records'),
  auditMiddleware('GET /records/:surveyNumber', (req) => req.params.surveyNumber),
  (req, res) => {
    const record = store.getRecord(req.params.surveyNumber);

    if (shouldSimulateFailure(req, record)) return sendSimulatedOutage(res);

    if (!record) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No land record found for survey number ${req.params.surveyNumber}.`
      });
    }

    const { simulateOutage, ...cleanRecord } = record;
    const payload = req.query.schema === 'canonical' ? toCanonical(cleanRecord) : cleanRecord;
    res.json(payload);
  }
);

/**
 * GET /api/land/status/:surveyNumber
 * Lightweight mutation-status check, in canonical field names —
 * this is what a polling consumer (like MPCB or the interop
 * platform) hits repeatedly while a dependency is WAITING.
 */
router.get(
  '/status/:surveyNumber',
  requirePermission('read:status'),
  auditMiddleware('GET /status/:surveyNumber', (req) => req.params.surveyNumber),
  (req, res) => {
    const record = store.getRecord(req.params.surveyNumber);

    if (shouldSimulateFailure(req, record)) return sendSimulatedOutage(res);

    if (!record) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No land record found for survey number ${req.params.surveyNumber}.`
      });
    }

    res.json({
      survey_number: record.gtn,
      mutation_status: record.jamabandi
    });
  }
);

/**
 * POST /api/land/verify
 * Body: { surveyNumber, pan }
 * Runs the deterministic policy engine and returns both the
 * canonical facts and the resulting dependency status. This is the
 * endpoint the interoperability layer's dependency engine calls to
 * decide whether a downstream department (e.g. MPCB) can proceed.
 */
router.post(
  '/verify',
  requirePermission('verify'),
  auditMiddleware('POST /verify', (req) => req.body && req.body.surveyNumber),
  (req, res) => {
    const { surveyNumber, pan } = req.body || {};

    if (!surveyNumber || !pan) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Both "surveyNumber" and "pan" are required in the request body.'
      });
    }

    const record = store.getRecord(surveyNumber);

    if (shouldSimulateFailure(req, record)) return sendSimulatedOutage(res);

    if (!record) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No land record found for survey number ${surveyNumber}.`
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
 * Demo-only "department action" endpoint — lets you advance a
 * record's mutation status (e.g. PENDING -> APPROVED) so a polling
 * consumer can observe the WAITING -> RESOLVED transition described
 * in Section 9, without waiting on a real registrar's office.
 */
router.patch(
  '/records/:surveyNumber/mutation',
  requirePermission('admin:mutation'),
  auditMiddleware('PATCH /records/:surveyNumber/mutation', (req) => req.params.surveyNumber),
  (req, res) => {
    const { mutation_status } = req.body || {};

    if (!mutation_status || !store.VALID_MUTATION_STATUSES.includes(mutation_status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `"mutation_status" must be one of: ${store.VALID_MUTATION_STATUSES.join(', ')}.`
      });
    }

    const updated = store.updateMutationStatus(req.params.surveyNumber, mutation_status);

    if (!updated) {
      return res.status(404).json({
        error: 'Not Found',
        message: `No land record found for survey number ${req.params.surveyNumber}.`
      });
    }

    res.json({
      survey_number: updated.gtn,
      mutation_status: updated.jamabandi,
      note: 'In-memory demo update only — resets on server restart.'
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
