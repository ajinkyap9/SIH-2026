const MAITRI_API = 'http://localhost:5000/api/portal';

async function fetchElecProfile() {
    const panEl = document.getElementById('applicantPan');
    const urlParams = new URLSearchParams(window.location.search);
    const panFromUrl = urlParams.get('pan') || '';
    const pan = (panEl?.value || panFromUrl || '').trim().toUpperCase();

    if (!pan || pan.length < 10) {
        alert('Please enter a valid 10-character PAN number in the Enterprise PAN field first.');
        return;
    }

    const bar = document.getElementById('elecAutoFillBar');
    const msg = document.getElementById('elecAutoFillMsg');
    if (bar) bar.style.display = 'block';
    if (msg) msg.textContent = '🔄 Fetching your profile from MAITRI database...';

    try {
        const res = await fetch(`${MAITRI_API}/user-profile?pan=${encodeURIComponent(pan)}`);
        const data = await res.json();

        if (data.success && data.found) {
            const p = data.profile;
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('applicantPan', p.pan);
            setVal('companyName', p.organization_name || p.full_name);
            setVal('authPerson', p.full_name);
            setVal('email', p.email);
            setVal('phone', p.mobile);

            if (msg) msg.innerHTML = `✅ Profile auto-filled for <strong>${p.organization_name || p.full_name}</strong>. All fields are editable.`;
            if (bar) { bar.style.background = '#f0fdf4'; bar.style.borderColor = '#86efac'; bar.style.color = '#15803d'; }
        } else {
            if (msg) msg.textContent = `⚠️ ${data.message || 'No profile found. Please fill manually.'}`;
            if (bar) { bar.style.background = '#fef9c3'; bar.style.borderColor = '#fde047'; bar.style.color = '#854d0e'; }
        }
    } catch (err) {
        if (msg) msg.textContent = '❌ Could not connect to MAITRI database. Please fill manually.';
        if (bar) { bar.style.background = '#fef2f2'; bar.style.borderColor = '#fca5a5'; bar.style.color = '#991b1b'; }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const appId = urlParams.get('app_id') || 'UNKNOWN-APP';
    const applicant = urlParams.get('applicant') || '';
    const project = urlParams.get('project') || '';
    const reqLoad = urlParams.get('req_load') || '';
    const callbackUrl = urlParams.get('callback');

    // 2. Prefill Form from URL params (MAITRI session data)
    const panFromUrl = urlParams.get('pan') || '';
    const emailFromUrl = urlParams.get('email') || '';
    const mobileFromUrl = urlParams.get('mobile') || '';

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    setVal('appId', appId);
    setVal('companyName', applicant);
    setVal('projectName', project);
    setVal('reqLoad', reqLoad);
    setVal('applicantPan', panFromUrl.toUpperCase());
    setVal('email', emailFromUrl);
    setVal('phone', mobileFromUrl);
    setVal('authPerson', applicant); // default auth person = company name until DB fill

    // Then fetch full profile from DB if PAN available (overrides with authoritative data)
    if (panFromUrl) {
        fetchElecProfile();
    }

    // 3. Handle Submission
    document.getElementById('submitBtn').addEventListener('click', async () => {

        const authPerson = document.getElementById('authPerson').value;
        const district = document.getElementById('district').value;
        
        if (!authPerson || !district) {
            alert("Please fill in the District and Authorized Person fields.");
            return;
        }

        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.textContent = 'Submitting to MSEDCL Grid System...';

        const pan = document.getElementById('applicantPan')?.value.trim().toUpperCase() || 'UNKNOWN';
        const company = document.getElementById('companyName')?.value.trim() || 'Applicant';
        const load = document.getElementById('reqLoad')?.value || '300';
        let refNumber = `ELEC-2026-${Date.now().toString().slice(-5)}`;

        try {
            const res = await fetch('/api/electricity/public-apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    application_number: refNumber,
                    applicant_name: company,
                    applicant_pan: pan,
                    requested_load: load,
                    district: district,
                    taluka: document.getElementById('taluka')?.value || 'Haveli',
                    address: document.getElementById('address')?.value || 'MIDC Industrial Area'
                })
            });
            const data = await res.json();
            if (data.success && data.application_number) {
                refNumber = data.application_number;
            }
        } catch (err) {
            console.warn('Electricity public-apply note:', err.message);
        }

        // Hide Form, Show Success
        document.getElementById('applicationForm').style.display = 'none';
        document.getElementById('successBox').style.display = 'block';

        // Update Success Details
        document.getElementById('refNumberDisplay').textContent = `MSEDCL Reference: ${refNumber}`;
        document.getElementById('successAppId').textContent = appId;
        document.getElementById('successLoad').textContent = `${reqLoad || '300'} kW (HT Sanctioned)`;

        // Configure Return Button
        document.getElementById('returnBtn').onclick = () => {
            if (callbackUrl) {
                const separator = callbackUrl.includes('?') ? '&' : '?';
                const finalUrl = `${callbackUrl}${separator}electricity_status=COMPLETED&electricity_ref=${refNumber}`;
                window.location.href = finalUrl;
            } else {
                window.location.href = 'http://localhost:5000/dashboard.html?tab=portal&electricity_status=COMPLETED&electricity_ref=' + refNumber;
            }
        };
    });
function switchElecTab(tab) {
    const formSec = document.getElementById('applicationForm');
    const recSec = document.getElementById('recordsSection');
    const applyBtn = document.getElementById('tabApplyBtn');
    const recBtn = document.getElementById('tabRecordsBtn');

    if (tab === 'records') {
        formSec.style.display = 'none';
        recSec.style.display = 'block';
        applyBtn.style.background = 'rgba(255,255,255,0.2)';
        applyBtn.style.color = 'white';
        recBtn.style.background = 'white';
        recBtn.style.color = '#0284c7';
        loadElectricityRecords();
    } else {
        formSec.style.display = 'block';
        recSec.style.display = 'none';
        applyBtn.style.background = 'white';
        applyBtn.style.color = '#0284c7';
        recBtn.style.background = 'rgba(255,255,255,0.2)';
        recBtn.style.color = 'white';
    }
}

async function loadElectricityRecords() {
    const tbody = document.getElementById('elecRecordsBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/electricity/public-list');
        const apps = await res.json();
        if (Array.isArray(apps) && apps.length > 0) {
            tbody.innerHTML = apps.map(a => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px; font-weight: 700; color: #0369a1;">${a.application_number}</td>
                    <td style="padding: 10px;">${a.applicant_name}</td>
                    <td style="padding: 10px; font-family: monospace;">${a.applicant_pan}</td>
                    <td style="padding: 10px;">${a.sanctioned_load !== 'N/A' ? a.sanctioned_load : a.requested_load}</td>
                    <td style="padding: 10px;">${a.district}</td>
                    <td style="padding: 10px;">
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background: ${a.application_status === 'APPROVED' ? '#dcfce7' : '#fef3c7'}; color: ${a.application_status === 'APPROVED' ? '#166534' : '#b45309'};">
                            ${a.application_status}
                        </span>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No records found in database.</td></tr>';
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Failed to load records from database.</td></tr>';
    }
}
