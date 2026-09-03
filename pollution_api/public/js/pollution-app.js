const MAITRI_API = 'http://localhost:5000/api/portal';

async function fetchPollProfile() {
  const panEl = document.getElementById('pan');
  const urlParams = new URLSearchParams(window.location.search);
  const panFromUrl = urlParams.get('pan') || '';
  const pan = (panEl?.value || panFromUrl || '').trim().toUpperCase();

  if (!pan || pan.length < 10) {
    alert('Please enter a valid 10-character Enterprise PAN first.');
    return;
  }

  const bar = document.getElementById('pollAutoFillBar');
  const msg = document.getElementById('pollAutoFillMsg');
  if (bar) bar.style.display = 'block';
  if (msg) msg.textContent = '🔄 Fetching your profile from MAITRI database...';

  try {
    const res = await fetch(`${MAITRI_API}/user-profile?pan=${encodeURIComponent(pan)}`);
    const data = await res.json();

    if (data.success && data.found) {
      const p = data.profile;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      setVal('pan', p.pan);
      setVal('companyName', p.organization_name || p.full_name);
      setVal('contactEmail', p.email);
      setVal('contactPhone', p.mobile);
      setVal('authRep', p.full_name);

      if (msg) msg.innerHTML = `✅ Profile auto-filled for <strong>${p.organization_name || p.full_name}</strong>. All fields are editable — modify as needed.`;
      if (bar) { bar.style.background = '#f0fdf4'; bar.style.borderColor = '#86efac'; bar.style.color = '#15803d'; }
    } else {
      if (msg) msg.textContent = `⚠️ ${data.message || 'No profile found for this PAN. Please fill manually.'}`;
      if (bar) { bar.style.background = '#fef9c3'; bar.style.borderColor = '#fde047'; bar.style.color = '#854d0e'; }
    }
  } catch (err) {
    if (msg) msg.textContent = '❌ Could not connect to MAITRI database. Please fill manually.';
    if (bar) { bar.style.background = '#fef2f2'; bar.style.borderColor = '#fca5a5'; bar.style.color = '#991b1b'; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Read URL Parameters from MAITRI callback mechanism
  const urlParams = new URLSearchParams(window.location.search);
  const appId = urlParams.get('app_id') || 'MAITRI-MH-101';
  const applicant = urlParams.get('applicant') || '';
  const industry = urlParams.get('industry') || 'Chemical';
  const callbackUrl = urlParams.get('callback');
  const panFromUrl = urlParams.get('pan') || '';
  const emailFromUrl = urlParams.get('email') || '';
  const mobileFromUrl = urlParams.get('mobile') || '';

  // 2. Prefill form fields from URL params
  const appIdEl = document.getElementById('appId');
  const companyEl = document.getElementById('companyName');
  const indTypeEl = document.getElementById('industryType');
  const panEl = document.getElementById('pan');
  const emailEl = document.getElementById('contactEmail');
  const phoneEl = document.getElementById('contactPhone');
  const authRepEl = document.getElementById('authRep');

  if (appIdEl) appIdEl.value = appId;
  if (applicant && companyEl) companyEl.value = applicant;
  if (indTypeEl) indTypeEl.value = `${industry} / Manufacturing`;
  if (panFromUrl && panEl) panEl.value = panFromUrl.toUpperCase();
  if (emailFromUrl && emailEl) emailEl.value = emailFromUrl;
  if (mobileFromUrl && phoneEl) phoneEl.value = mobileFromUrl;
  if (applicant && authRepEl) authRepEl.value = applicant;

  // 3. Auto-fetch full profile from DB if PAN available
  if (panFromUrl) {
    fetchPollProfile();
  }


  // 3. Handle Submission
  document.getElementById('submitBtn').addEventListener('click', async () => {
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Submitting to MPCB Registry...';

    const panVal = document.getElementById('pan')?.value.trim().toUpperCase() || 'UNKNOWN';
    const compVal = document.getElementById('companyName')?.value.trim() || 'Applicant Enterprise';
    let refNumber = `MPCB-${Date.now().toString().slice(-4)}`;

    try {
      const res = await fetch('/api/pollution/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationNo: refNumber,
          industryName: compVal,
          industryPan: panVal,
          plantLocation: document.getElementById('address')?.value || 'MIDC Industrial Area',
          region: document.getElementById('district')?.value || 'Pune',
          industryType: document.getElementById('industryType')?.value || 'Manufacturing',
          consentType: document.getElementById('consentType')?.value || 'CTE',
          airEmissionCategory: document.getElementById('airCategory')?.value || 'RED'
        })
      });
      const data = await res.json();
      if (data.success && data.application_no) {
        refNumber = data.application_no;
      }
    } catch (err) {
      console.warn('Pollution apply note:', err.message);
    }

    // Hide form, show success
    document.getElementById('applicationForm').style.display = 'none';
    document.getElementById('successBox').style.display = 'block';

    document.getElementById('refNumberDisplay').textContent = `MPCB Reference: ${refNumber}`;
    document.getElementById('successAppId').textContent = appId;

    // Return button
    document.getElementById('returnBtn').addEventListener('click', () => {
      if (callbackUrl) {
        const separator = callbackUrl.includes('?') ? '&' : '?';
        const finalUrl = `${callbackUrl}${separator}pollution_status=COMPLETED&pollution_ref=${refNumber}`;
        window.location.href = finalUrl;
      } else {
        window.location.href = `http://localhost:5000/dashboard.html?tab=portal&pollution_status=COMPLETED&pollution_ref=${refNumber}`;
      }
    });
  });
});

function switchPollTab(tab) {
  const formSec = document.getElementById('applicationForm');
  const recSec = document.getElementById('pollRecordsSection');
  const applyBtn = document.getElementById('tabPollApplyBtn');
  const recBtn = document.getElementById('tabPollRecordsBtn');

  if (tab === 'records') {
    formSec.style.display = 'none';
    recSec.style.display = 'block';
    applyBtn.style.background = 'rgba(255,255,255,0.2)';
    applyBtn.style.color = 'white';
    recBtn.style.background = 'white';
    recBtn.style.color = '#166534';
    loadPollutionRecords();
  } else {
    formSec.style.display = 'block';
    recSec.style.display = 'none';
    applyBtn.style.background = 'white';
    applyBtn.style.color = '#166534';
    recBtn.style.background = 'rgba(255,255,255,0.2)';
    recBtn.style.color = 'white';
  }
}

async function loadPollutionRecords() {
  const tbody = document.getElementById('pollRecordsBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/pollution/all');
    const data = await res.json();
    const apps = data.applications || [];

    if (apps.length > 0) {
      tbody.innerHTML = apps.map(a => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: 700; color: #15803d;">${a.application_no}</td>
          <td style="padding: 10px;">${a.industry_name}</td>
          <td style="padding: 10px; font-family: monospace;">${a.industry_pan}</td>
          <td style="padding: 10px;">${a.consent_type}</td>
          <td style="padding: 10px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background: #fee2e2; color: #991b1b;">
              ${a.air_emission_category || 'RED'}
            </span>
          </td>
          <td style="padding: 10px;">${a.compliance_status}</td>
          <td style="padding: 10px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background: ${a.consent_status === 'APPROVED' ? '#dcfce7' : '#fef3c7'}; color: ${a.consent_status === 'APPROVED' ? '#166534' : '#b45309'};">
              ${a.consent_status}
            </span>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No records found in database.</td></tr>';
    }
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red; padding: 20px;">Failed to load records from database.</td></tr>';
  }
}
