const MAITRI_API = 'http://localhost:5000/api/portal';

async function fetchElecProfile() {
    const panEl = document.getElementById('pan');
    const urlParams = new URLSearchParams(window.location.search);
    const panFromUrl = urlParams.get('pan') || '';
    const pan = (panEl?.value || panFromUrl || '').trim().toUpperCase();

    if (!pan || pan.length < 10) {
        alert('Please enter a valid 10-character PAN number first.');
        return;
    }

    const bar = document.getElementById('elecAutoFillBar');
    const msg = document.getElementById('elecAutoFillMsg');
    if (bar) bar.style.display = 'block';
    if (msg) msg.textContent = '🔄 Fetching your profile from database...';

    try {
        const res = await fetch(`${MAITRI_API}/user-profile?pan=${encodeURIComponent(pan)}`);
        const data = await res.json();

        if (data.success && data.found) {
            const p = data.profile;
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('pan', p.pan);
            setVal('companyName', p.organization_name || p.full_name);
            setVal('authPerson', p.full_name);
            setVal('email', p.email);
            setVal('phone', p.mobile);

            if (msg) msg.innerHTML = `✅ Profile auto-filled for <strong>${p.organization_name || p.full_name}</strong>. All fields are editable.`;
            if (bar) {
                bar.style.background = '#f0fdf4';
                bar.style.borderColor = '#86efac';
                bar.style.color = '#15803d';
            }
        } else {
            if (msg) msg.textContent = `⚠️ ${data.message || 'No profile found. Please fill manually.'}`;
            if (bar) {
                bar.style.background = '#fef9c3';
                bar.style.borderColor = '#fde047';
                bar.style.color = '#854d0e';
            }
        }
    } catch (err) {
        if (msg) msg.textContent = '❌ Could not connect to database. Please fill manually.';
        if (bar) {
            bar.style.background = '#fef2f2';
            bar.style.borderColor = '#fca5a5';
            bar.style.color = '#991b1b';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const appId = urlParams.get('app_id') || 'UNKNOWN-APP';
    const applicant = urlParams.get('applicant') || '';
    const project = urlParams.get('project') || '';
    const reqLoad = urlParams.get('req_load') || '';
    const pan = urlParams.get('pan') || '';
    const callbackUrl = urlParams.get('callback');

    // 2. Prefill Form
    document.getElementById('appId').value = appId;
    if (applicant) document.getElementById('companyName').value = applicant;
    if (project) document.getElementById('projectName').value = project;
    if (reqLoad) document.getElementById('reqLoad').value = reqLoad;
    if (pan && document.getElementById('pan')) document.getElementById('pan').value = pan.toUpperCase();

    // Auto-fetch profile from database if PAN is available
    if (pan) {
        fetchElecProfile();
    }


    // 3. Handle Submission
    document.getElementById('submitBtn').addEventListener('click', async () => {
        // Defaults for required fields
        const authPerson = document.getElementById('authPerson').value || applicant || 'Authorized Person';
        const district = document.getElementById('district').value || 'Pune';
        document.getElementById('authPerson').value = authPerson;
        document.getElementById('district').value = district;

        const currentComp = document.getElementById('companyName').value || 'Industrial Applicant';
        const currentPan = (document.getElementById('pan')?.value || pan || 'ABCDE1234F').toUpperCase();
        const currentLoad = document.getElementById('reqLoad')?.value || reqLoad || '300';

        // Generate Reference Number
        const randomRef = Math.floor(10000 + Math.random() * 90000);
        let refNumber = `ELEC-2026-${randomRef}`;

        // Persist to PostgreSQL backend
        try {
            const res = await fetch('/api/electricity/public-apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    application_number: refNumber,
                    applicant_name: currentComp,
                    applicant_pan: currentPan,
                    requested_load: currentLoad,
                    district: district,
                    taluka: document.getElementById('taluka')?.value || 'Haveli',
                    address: document.getElementById('address')?.value || 'MIDC Industrial Area'
                })
            });
            const data = await res.json();
            if (data.success && data.application_number) {
                refNumber = data.application_number;
            }
        } catch (e) {
            console.warn('Electricity backend public-apply note:', e.message);
        }

        // Hide Form, Show Success
        document.getElementById('applicationForm').style.display = 'none';
        document.getElementById('successBox').style.display = 'block';

        // Update Success Details
        document.getElementById('refNumberDisplay').textContent = `MSEDCL Reference: ${refNumber}`;
        document.getElementById('successAppId').textContent = appId;
        document.getElementById('successLoad').textContent = `${reqLoad || '5000'} kVA`;

        // Configure Return Button
        document.getElementById('returnBtn').addEventListener('click', () => {
            if (callbackUrl) {
                // Determine separator for appending query parameters
                const separator = callbackUrl.includes('?') ? '&' : '?';
                const finalUrl = `${callbackUrl}${separator}electricity_status=COMPLETED&electricity_ref=${refNumber}`;
                
                // Redirect back to MAITRI in this tab
                window.location.href = finalUrl;
            } else {
                alert("No callback URL provided by MAITRI. Closing window.");
                window.close();
            }
        });
    });
});
