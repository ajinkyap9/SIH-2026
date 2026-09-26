const SAMANVAY_API = `http://${window.location.hostname}:5000/api/portal`;
let currentCallbackUrl = null;

function switchTab(tabId) {
  const tabs = ['status', 'category', 'apply', 'notice', 'database'];
  tabs.forEach(t => {
    const navEl = document.getElementById(`nav-${t}`);
    const secEl = document.getElementById(`section-${t}`);
    if (navEl) navEl.classList.toggle('active', t === tabId);
    if (secEl) secEl.style.display = (t === tabId) ? 'block' : 'none';
  });

  if (tabId === 'notice') renderNoticeTab();
  if (tabId === 'database') renderDatabaseTab();
}

async function fetchPollProfile() {
  const panEl = document.getElementById('pan');
  const urlParams = new URLSearchParams(window.location.search);
  const panFromUrl = urlParams.get('pan') || '';
  const pan = (panEl?.value || panFromUrl || '').trim().toUpperCase();

  if (!pan || pan.length < 10) {
    alert('Please enter a valid 10-character PAN number first.');
    return;
  }

  const bar = document.getElementById('pollAutoFillBar');
  const msg = document.getElementById('pollAutoFillMsg');
  if (bar) bar.style.display = 'block';
  if (msg) msg.textContent = '🔄 Fetching profile from database...';

  try {
    const res = await fetch(`${SAMANVAY_API}/user-profile?pan=${encodeURIComponent(pan)}`);
    const data = await res.json();

    if (data.success && data.found) {
      const p = data.profile;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      setVal('pan', p.pan);
      setVal('companyName', p.organization_name || p.full_name);

      if (msg) msg.innerHTML = `✅ Profile auto-filled for <strong>${p.organization_name || p.full_name}</strong>. All fields editable.`;
      if (bar) {
        bar.style.background = '#f0fdf4';
        bar.style.borderColor = '#86efac';
        bar.style.color = '#15803d';
      }
    } else {
      if (msg) msg.textContent = `⚠️ ${data.message || 'No profile found. Fill manually.'}`;
    }
  } catch (err) {
    if (msg) msg.textContent = '❌ Could not connect to database. Fill manually.';
  }
}

function presetPollLookup(query) {
  const input = document.getElementById('pollQuery');
  if (input) {
    input.value = query;
    handleSearchPoll(new Event('submit'));
  }
}

async function handleSearchPoll(e) {
  if (e) e.preventDefault();
  const q = document.getElementById('pollQuery').value.trim();
  const resultDiv = document.getElementById('resultPoll');
  if (!q) return;

  resultDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #4f6e5c;">🔄 Fetching DPCC environmental consent facts...</div>';

  try {
    const res = await fetch(`/api/pollution/applications/${q}`, {
      headers: { 'X-API-Key': 'interop-demo-key-001' }
    });

    if (!res.ok) {
      resultDiv.innerHTML = `
        <div class="pol-card" style="padding: 24px; border-left: 4px solid #ef4444;">
          <h3 style="color: #dc2626; margin-bottom: 8px;">⚠️ Record Not Found</h3>
          <p style="font-size: 0.9rem; color: #4f6e5c;">No pollution consent record found for query "<strong>${q}</strong>".</p>
          <p style="font-size: 0.85rem; margin-top: 10px;">Try presets like <code>MPCB-8821</code> or submit a new application in the <strong>Apply</strong> tab.</p>
        </div>
      `;
      return;
    }

    const data = await res.json();
    renderPollSheet(data);
  } catch (err) {
    resultDiv.innerHTML = `<div style="padding: 20px; color: #dc2626;">❌ Error connecting to Pollution API: ${err.message}</div>`;
  }
}

function renderPollSheet(data) {
  const div = document.getElementById('resultPoll');
  const appNo = data.application_no || data.applicationNo || 'MPCB-8821';
  const name = data.industry_name || data.industryName || 'Enterprise Applicant';
  const pan = data.industry_pan || data.industryPan || 'ABCDE1234F';
  const category = data.air_emission_category || 'GREEN';
  const consentType = data.consent_type || 'CTE';
  const status = data.consent_status || 'APPROVED';
  const compliance = data.compliance_status || 'COMPLIANT';
  const location = data.plant_location || 'MIDC Chakan, Pune';
  const validUntil = data.valid_until || '2029-03-31';

  const statusBadge = status === 'APPROVED'
    ? '<span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 4px; font-weight: 700;">APPROVED & COMPLIANT</span>'
    : '<span style="background: #fef9c3; color: #854d0e; padding: 4px 10px; border-radius: 4px; font-weight: 700;">PENDING EVALUATION</span>';

  div.innerHTML = `
    <div class="poll-sheet">
      <div class="poll-watermark">STATE POLLUTION CONTROL BOARD</div>

      <div class="poll-header-sheet">
        <h2 style="color: #14422b; font-size: 1.3rem;">SAMANVAY POLLUTION CONTROL DEPARTMENT</h2>
        <h3 style="font-size: 1.05rem; color: #1f2937;">ENVIRONMENTAL CONSENT TO ESTABLISH / OPERATE CERTIFICATE</h3>
        <p style="font-size: 0.85rem; color: #4f6e5c;">Department of Environment • State Pollution Control Board</p>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div><strong>Application Ref:</strong> <code>${appNo}</code></div>
        <div><strong>Consent Status:</strong> ${statusBadge}</div>
      </div>

      <table class="poll-table">
        <tr>
          <th>Enterprise Name</th>
          <td><strong>${name}</strong></td>
          <th>Enterprise PAN</th>
          <td><code>${pan}</code></td>
        </tr>
        <tr>
          <th>Consent Type</th>
          <td><strong>${consentType}</strong> (Consent to Establish)</td>
          <th>Pollution Category</th>
          <td><span style="color: #15803d; font-weight: 700;">${category} CATEGORY</span></td>
        </tr>
        <tr>
          <th>Plant Location</th>
          <td>${location}</td>
          <th>Consent Validity</th>
          <td><strong>${validUntil}</strong></td>
        </tr>
        <tr>
          <th>Compliance Record</th>
          <td><strong style="color: #166534;">${compliance}</strong></td>
          <th>Clearance Type</th>
          <td>Single-Window Fast Track</td>
        </tr>
      </table>

      <div style="margin-top: 16px; background: #f0fdf4; padding: 12px; border-radius: 6px; font-size: 0.85rem; color: #166534;">
        🌿 <strong>Environmental Facts Verified:</strong> Zero trade effluent discharge verified. Air emission norms satisfied under Water (Prevention and Control of Pollution) Act 1974.
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; font-size: 0.8rem; color: #4f6e5c;">
        <div>Digitally authorized by Member Secretary (State Pollution Control Board)</div>
        <button onclick="window.print()" class="pol-btn pol-btn-outline" style="padding: 4px 12px; font-size: 0.8rem;">🖨️ Print Consent Certificate</button>
      </div>
    </div>
  `;
}

async function handleApplyPollSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('companyName').value.trim();
  const pan = document.getElementById('pan').value.trim().toUpperCase();
  const category = document.getElementById('industryCategory').value;
  const consentType = document.getElementById('consentType').value;
  const location = document.getElementById('location').value.trim();

  const refNumber = `MPCB-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    await fetch('/api/pollution/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationNo: refNumber,
        industryName: name,
        industryPan: pan,
        plantLocation: location,
        industryType: category,
        consentType: consentType
      })
    });
  } catch (err) {
    console.warn('Pollution backend apply notice:', err);
  }

  // Show Banner Message
  const banner = document.getElementById('submissionSuccessBanner');
  const bannerMsg = document.getElementById('submissionSuccessMsg');
  if (banner && bannerMsg) {
    bannerMsg.innerHTML = `Environmental Consent Application <strong>${refNumber}</strong> submitted successfully! Displaying your approved consent certificate below.`;
    banner.style.display = 'block';
  }

  // Handle Return to SAMANVAY Button
  const returnBtn = document.getElementById('returnBtn');
  const targetUrl = currentCallbackUrl || `http://${window.location.hostname}:5000/dashboard.html?tab=flowchart`;
  if (returnBtn) {
    returnBtn.style.display = 'inline-flex';
    returnBtn.onclick = (e) => {
      e.preventDefault();
      const sep = targetUrl.includes('?') ? '&' : '?';
      const url = `${targetUrl}${sep}mpcb_status=APPROVED&mpcb_ref=${encodeURIComponent(refNumber)}`;
      try {
        window.opener.location.href = url;
        window.close();
      } catch (err) {
        window.location.href = url;
      }
    };
  }

  // REDIRECT / TAKE USER BACK TO HOME PAGE (STATUS TAB)
  switchTab('status');

  // Populate search input with the new reference and auto-render!
  const pollInput = document.getElementById('pollQuery');
  if (pollInput) {
    pollInput.value = refNumber;
  }
  handleSearchPoll(null);
}

function renderNoticeTab() {
  const div = document.getElementById('resultNotice');
  div.innerHTML = `
    <div style="font-size: 0.95rem; color: #1b2e23;">
      <h3 style="color: var(--pol-green); margin-bottom: 12px;">🌿 Maharashtra Pollution Control Board (MPCB) Notices</h3>
      <ul style="margin-left: 20px; line-height: 1.8;">
        <li><strong>Green Category Fast-Track:</strong> Industrial CTE applications in Green category processed within 48 hours.</li>
        <li><strong>Air Quality Index (AQI) Compliance:</strong> Industrial boiler stack monitoring digitized across Okhla & Narela zones.</li>
      </ul>
    </div>
  `;
}

function renderDatabaseTab() {
  const div = document.getElementById('resultDatabase');
  div.innerHTML = `
    <div style="font-size: 0.9rem;">
      <p style="margin-bottom: 12px; color: #4f6e5c;">Maharashtra Pollution Control Board (MPCB) API endpoints available for SAMANVAY Interoperability Layer:</p>
      <pre style="background: #0d281a; color: #a5d6a7; padding: 14px; border-radius: 6px; font-family: monospace;">
GET  /api/pollution/applications/:applicationNo
GET  /api/pollution/status/:applicationNo
POST /api/pollution/verify
POST /api/pollution/apply
      </pre>
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const appId = urlParams.get('app_id');
  const pan = urlParams.get('pan');
  const applicant = urlParams.get('applicant');
  currentCallbackUrl = urlParams.get('callback');

  if (appId) {
    const el = document.getElementById('appId');
    if (el) el.value = appId;
  }
  if (pan) {
    const el = document.getElementById('pan');
    if (el) el.value = pan.toUpperCase();
    fetchPollProfile();
  }
  if (applicant) {
    const el = document.getElementById('companyName');
    if (el) el.value = applicant;
  }

  // Default initial tab
  switchTab('apply');
});

// Ensure every static "return to Samanvay" link uses the current device's
// hostname rather than a hardcoded value, so this page works correctly whether
// accessed via localhost or a LAN IP.
window.addEventListener('DOMContentLoaded', () => {
  const portalUrl = currentCallbackUrl || `http://${window.location.hostname}:5000/dashboard.html?tab=flowchart`;
  ['topSamanvayBtn', 'navSamanvayBtn', 'footerSamanvayBtn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.onclick = (e) => {
        e.preventDefault();
        try {
          window.opener.location.href = portalUrl;
          window.close();
        } catch (err) {
          window.location.href = portalUrl;
        }
      };
    }
  });
});
