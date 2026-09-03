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
