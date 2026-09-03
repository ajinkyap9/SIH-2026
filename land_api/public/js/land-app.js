/**
 * Land Records Department — Independent Frontend Application
 * ============================================================
 * This JavaScript is completely standalone. It does NOT import,
 * reference, or depend on any MAITRI UI code or modules.
 * It communicates solely with the Land API at localhost:4000.
 * ============================================================
 */

const LAND_API = 'http://localhost:4000/api/land';
const API_KEY = 'interop-demo-key-001';

// Read URL params for MAITRI integration (callback mechanism)
const urlParams = new URLSearchParams(window.location.search);
const maitriAppId = urlParams.get('app_id');
const maitriCallback = urlParams.get('callback');
const maitriSurvey = urlParams.get('survey');
const maitriPan = urlParams.get('pan');

// If arriving from MAITRI with context, pre-fill and go to apply
window.addEventListener('DOMContentLoaded', () => {
  if (maitriAppId && maitriSurvey) {
    // Pre-fill the apply form with MAITRI context
    switchTab('apply');
    if (maitriPan && document.getElementById('applyPan')) {
      document.getElementById('applyPan').value = maitriPan;
    }
    if (maitriSurvey && document.getElementById('applySurvey')) {
      document.getElementById('applySurvey').value = maitriSurvey;
    }
    const maitriApplicant = urlParams.get('applicant');
    if (maitriApplicant) {
      if (document.getElementById('applyName')) document.getElementById('applyName').value = maitriApplicant;
      if (document.getElementById('applyOrg')) document.getElementById('applyOrg').value = maitriApplicant;
    }
    const maitriPhone = urlParams.get('mobile');
    if (maitriPhone && document.getElementById('applyPhone')) {
      document.getElementById('applyPhone').value = maitriPhone;
    }
  }

  // Load all records for the "All Records" tab
  loadAllRecords();
});

// =============================================
// TAB SWITCHING
// =============================================
function switchTab(tab) {
  const sections = ['trackSection', 'applySection', 'recordsSection'];
  sections.forEach(s => {
    document.getElementById(s).style.display = 'none';
  });

  const navLinks = document.querySelectorAll('.land-nav a');
  navLinks.forEach(a => a.classList.remove('active'));

  if (tab === 'track') {
    document.getElementById('trackSection').style.display = 'block';
    navLinks[1].classList.add('active');
  } else if (tab === 'apply') {
    document.getElementById('applySection').style.display = 'block';
    navLinks[2].classList.add('active');
    resetStepper();
  } else if (tab === 'records') {
    document.getElementById('recordsSection').style.display = 'block';
    navLinks[3].classList.add('active');
    loadAllRecords();
  } else {
    // Home = track by default
    document.getElementById('trackSection').style.display = 'block';
    navLinks[0].classList.add('active');
  }
}

// =============================================
// TRACK / VERIFY RECORD
// =============================================
function presetTrack(survey, pan) {
  document.getElementById('trackSurvey').value = survey;
  document.getElementById('trackPan').value = pan || '';
  document.getElementById('trackForm').dispatchEvent(new Event('submit', { cancelable: true }));
}

async function handleTrackSubmit(e) {
  e.preventDefault();
  const survey = document.getElementById('trackSurvey').value.trim();
  const pan = document.getElementById('trackPan')?.value.trim();
  const query = survey || pan;
  if (!query) return;

  const btn = document.getElementById('trackBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="land-spinner"></span> Fetching...';

  hideError();
  document.getElementById('trackResult').style.display = 'none';

  try {
    const res = await fetch(`${LAND_API}/records/${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY }
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.message || data.error || 'Record not found in database');
      btn.disabled = false;
      btn.textContent = 'Fetch Land Record';
      return;
    }

    displayTrackResult(data);
    document.getElementById('trackJson').textContent = JSON.stringify(data, null, 2);
    document.getElementById('trackResult').style.display = 'block';
  } catch (err) {
    showError('Cannot connect to Land Department API. Is it running on port 4000?');
  }

  btn.disabled = false;
  btn.textContent = 'Fetch Land Record';
}

function displayTrackResult(record) {
  const badge = document.getElementById('trackMutationBadge');
  badge.textContent = record.jamabandi;
  badge.className = 'land-badge ' + (
    record.jamabandi === 'APPROVED' ? 'land-badge-approved' :
    record.jamabandi === 'PENDING' ? 'land-badge-pending' : 'land-badge-rejected'
  );

  const details = document.getElementById('trackDetails');
  details.innerHTML = `
    <div class="land-detail-row">
      <span class="land-detail-label">Survey / Gat Number</span>
      <span class="land-detail-value">${record.gtn}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Owner Name (मालक)</span>
      <span class="land-detail-value">${record.malak_name}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Owner PAN</span>
      <span class="land-detail-value">${record.malak_pan}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Area (क्षेत्र)</span>
      <span class="land-detail-value">${record.kshetra} ${record.kshetra_unit}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Land Type (जमीन प्रकार)</span>
      <span class="land-detail-value">${record.jamin_prakar}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Mutation Status (जमाबंदी)</span>
      <span class="land-detail-value" style="color: ${record.jamabandi === 'APPROVED' ? 'var(--land-success)' : record.jamabandi === 'PENDING' ? 'var(--land-warning)' : 'var(--land-danger)'};">${record.jamabandi}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Encumbrance (बंधक)</span>
      <span class="land-detail-value">${record.bandhak ? '⚠️ Yes' : '✅ None'}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Court Case Pending</span>
      <span class="land-detail-value">${record.court_case ? '⚠️ Yes' : '✅ None'}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">District</span>
      <span class="land-detail-value">${record.district}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Taluka</span>
      <span class="land-detail-value">${record.taluka}</span>
    </div>
    <div class="land-detail-row">
      <span class="land-detail-label">Village</span>
      <span class="land-detail-value">${record.village}</span>
    </div>
  `;
}

// =============================================
// APPLY FOR CERTIFICATE — STEPPER
// =============================================
let currentStep = 1;

function resetStepper() {
  currentStep = 1;
  updateStepperUI();
  document.getElementById('applyStep1').style.display = 'block';
  document.getElementById('applyStep2').style.display = 'none';
  document.getElementById('applyStep3').style.display = 'none';
  document.getElementById('applySuccess').style.display = 'none';
}

function goToStep(step) {
  // Validate before advancing
  if (step === 2 && currentStep === 1) {
    const name = document.getElementById('applyName').value.trim();
    const pan = document.getElementById('applyPan').value.trim();
    const phone = document.getElementById('applyPhone').value.trim();
    if (!name || !pan || !phone) {
      alert('Please fill all required fields before proceeding.');
      return;
    }
  }
  if (step === 3 && currentStep === 2) {
    const district = document.getElementById('applyDistrict').value;
    const taluka = document.getElementById('applyTaluka').value.trim();
    const survey = document.getElementById('applySurvey').value.trim();
    if (!district || !taluka || !survey) {
      alert('Please fill all required fields before proceeding.');
      return;
    }
    populateReview();
  }

  currentStep = step;
  updateStepperUI();

  document.getElementById('applyStep1').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('applyStep2').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('applyStep3').style.display = step === 3 ? 'block' : 'none';
}

function updateStepperUI() {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`step${i}`);
    el.classList.remove('active', 'completed');
    if (i < currentStep) el.classList.add('completed');
    if (i === currentStep) el.classList.add('active');
  }
}

function populateReview() {
  const content = document.getElementById('applyReviewContent');
  content.innerHTML = `
    <div style="margin-bottom: 20px;">
      <strong style="font-size: 0.82rem; color: var(--land-primary); text-transform: uppercase; letter-spacing: 0.5px;">Applicant Details</strong>
      <div class="land-detail-row"><span class="land-detail-label">Name</span><span class="land-detail-value">${document.getElementById('applyName').value}</span></div>
      <div class="land-detail-row"><span class="land-detail-label">PAN</span><span class="land-detail-value">${document.getElementById('applyPan').value.toUpperCase()}</span></div>
      <div class="land-detail-row"><span class="land-detail-label">Organization</span><span class="land-detail-value">${document.getElementById('applyOrg').value || '—'}</span></div>
      <div class="land-detail-row"><span class="land-detail-label">Contact</span><span class="land-detail-value">${document.getElementById('applyPhone').value}</span></div>
    </div>
    <div>
      <strong style="font-size: 0.82rem; color: var(--land-primary); text-transform: uppercase; letter-spacing: 0.5px;">Land Details</strong>
      <div class="land-detail-row"><span class="land-detail-label">District</span><span class="land-detail-value">${document.getElementById('applyDistrict').value}</span></div>
      <div class="land-detail-row"><span class="land-detail-label">Taluka</span><span class="land-detail-value">${document.getElementById('applyTaluka').value}</span></div>
      <div class="land-detail-row"><span class="land-detail-label">Village</span><span class="land-detail-value">${document.getElementById('applyVillage').value || '—'}</span></div>
      <div class="land-detail-row"><span class="land-detail-label">Survey / Gat No</span><span class="land-detail-value">${document.getElementById('applySurvey').value}</span></div>
      <div class="land-detail-row"><span class="land-detail-label">Area</span><span class="land-detail-value">${document.getElementById('applyArea').value || '—'} Ha</span></div>
      <div class="land-detail-row"><span class="land-detail-label">Certificate Type</span><span class="land-detail-value">${document.getElementById('applyCertType').value.replace(/_/g, ' ')}</span></div>
      <div class="land-detail-row"><span class="land-detail-label">Purpose</span><span class="land-detail-value">${document.getElementById('applyPurpose').value}</span></div>
    </div>
  `;
}

async function handleApplySubmit() {
  const btn = document.getElementById('applySubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="land-spinner"></span> Submitting...';

  const pan = document.getElementById('applyPan').value.trim().toUpperCase();
  const survey = document.getElementById('applySurvey').value.trim();
  let refNo = 'LND-' + Date.now().toString().slice(-8);

  try {
    const res = await fetch(`${LAND_API}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surveyNumber: survey,
        pan: pan,
        applicantName: document.getElementById('applyName')?.value.trim(),
        district: document.getElementById('applyDistrict')?.value,
        taluka: document.getElementById('applyTaluka')?.value,
        village: document.getElementById('applyVillage')?.value,
        area: document.getElementById('applyArea')?.value,
        certificateType: document.getElementById('applyCertType')?.value
      })
    });
    const data = await res.json();
    if (data.success && data.application_ref) {
      refNo = data.application_ref;
    }
  } catch (err) {
    console.warn('Backend apply call note:', err.message);
  }

  document.getElementById('applyRefNo').textContent = refNo;

  // Hide stepper and show success
  document.getElementById('applyStep3').style.display = 'none';
  document.getElementById('applySuccess').style.display = 'block';

  // Show return-to-MAITRI if we came from there
  if (maitriAppId) {
    document.getElementById('returnToMaitriSection').style.display = 'block';
  }

  // Mark all steps as completed
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`step${i}`).classList.remove('active');
    document.getElementById(`step${i}`).classList.add('completed');
  }

  btn.disabled = false;
  btn.textContent = 'Submit Application';

  loadAllRecords();
}

// =============================================
// RETURN TO MAITRI (CALLBACK)
// =============================================
function returnToMaitri() {
  const refNo = document.getElementById('applyRefNo').textContent;
  if (maitriCallback) {
    // Navigate the opener (MAITRI) to the callback URL
    const callbackUrl = `${maitriCallback}?app_id=${encodeURIComponent(maitriAppId)}&land_status=COMPLETED&land_ref=${encodeURIComponent(refNo)}`;
    if (window.opener && !window.opener.closed) {
      window.opener.location.href = callbackUrl;
      window.close();
    } else {
      window.location.href = callbackUrl;
    }
  } else {
    // Fallback: just go to MAITRI
    window.location.href = 'http://localhost:5000/dashboard.html';
  }
}

// =============================================
// ALL RECORDS
// =============================================
async function loadAllRecords() {
  const body = document.getElementById('allRecordsBody');

  try {
    const res = await fetch(`${LAND_API}/all`);
    const data = await res.json();
    const records = data.records || [];

    if (body) {
      if (records.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px;">No records found in database.</td></tr>';
        return;
      }
      body.innerHTML = records.map(record => {
        const badgeClass = record.jamabandi === 'APPROVED' ? 'land-badge-approved' :
                           record.jamabandi === 'PENDING' ? 'land-badge-pending' : 'land-badge-rejected';
        return `
          <tr style="cursor: pointer;" onclick="presetTrack('${record.gtn}', '${record.malak_pan}'); switchTab('track');">
            <td><strong>${record.gtn}</strong></td>
            <td>${record.malak_name}</td>
            <td style="font-family: monospace; font-size: 0.82rem;">${record.malak_pan}</td>
            <td>${record.kshetra} ${record.kshetra_unit}</td>
            <td>${record.district}</td>
            <td>${record.jamin_prakar}</td>
            <td><span class="land-badge ${badgeClass}">${record.jamabandi}</span></td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    if (body) body.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--land-danger); padding: 32px;">Failed to load records. Is the Land API running?</td></tr>';
  }
}

// =============================================
// HELPERS
// =============================================
function showError(msg) {
  const el = document.getElementById('trackError');
  el.innerHTML = `<strong>Error:</strong> ${msg}`;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('trackError').style.display = 'none';
}
