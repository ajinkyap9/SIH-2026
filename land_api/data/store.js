const seedRecords = require('./landRecords.json');

/**
 * In-memory store, seeded from landRecords.json on startup.
 * Mutation-status updates (via the admin demo endpoint) live only
 * in memory and reset on restart — this is a legacy-department
 * simulator, not a system of record.
 */
const records = new Map(seedRecords.map((r) => [r.gtn, { ...r }]));

const VALID_MUTATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'UNDER_OBJECTION'];

function getRecord(surveyNumber) {
  return records.get(String(surveyNumber)) || null;
}

function updateMutationStatus(surveyNumber, newStatus) {
  const record = getRecord(surveyNumber);
  if (!record) return null;
  record.jamabandi = newStatus;
  records.set(String(surveyNumber), record);
  return record;
}

function listSurveyNumbers() {
  return Array.from(records.keys());
}

module.exports = {
  getRecord,
  updateMutationStatus,
  listSurveyNumbers,
  VALID_MUTATION_STATUSES
};
