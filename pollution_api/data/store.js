const seedApplications = require('./pollutionApplications.json');

const applications = new Map(
  seedApplications.map((application) => [application.application_no, { ...application }])
);

const VALID_CONSENT_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'UNDER_OBJECTION'
];

const VALID_COMPLIANCE_STATUSES = [
  'COMPLIANT',
  'UNDER_REVIEW',
  'ACTION_REQUIRED',
  'NON_COMPLIANT'
];

function getApplication(applicationNo) {
  return applications.get(String(applicationNo)) || null;
}

function updateConsentStatus(applicationNo, newStatus) {
  const application = getApplication(applicationNo);
  if (!application) return null;

  application.consent_status = newStatus;

  if (newStatus === 'APPROVED') {
    application.compliance_status = 'COMPLIANT';
    if (!application.valid_until) application.valid_until = '2027-03-31';
  } else if (newStatus === 'REJECTED') {
    application.compliance_status = 'NON_COMPLIANT';
    application.valid_until = null;
  } else if (newStatus === 'UNDER_OBJECTION') {
    application.compliance_status = 'ACTION_REQUIRED';
    application.valid_until = null;
  } else if (newStatus === 'PENDING') {
    application.compliance_status = 'UNDER_REVIEW';
    application.valid_until = null;
  }

  applications.set(String(applicationNo), application);
  return application;
}

function listApplicationNumbers() {
  return Array.from(applications.keys());
}

module.exports = {
  getApplication,
  updateConsentStatus,
  listApplicationNumbers,
  VALID_CONSENT_STATUSES,
  VALID_COMPLIANCE_STATUSES
};
