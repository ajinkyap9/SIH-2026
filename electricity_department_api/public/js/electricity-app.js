document.addEventListener('DOMContentLoaded', () => {
    // 1. Read URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const appId = urlParams.get('app_id') || 'UNKNOWN-APP';
    const applicant = urlParams.get('applicant') || '';
    const project = urlParams.get('project') || '';
    const reqLoad = urlParams.get('req_load') || '';
    const callbackUrl = urlParams.get('callback');

    // 2. Prefill Form
    document.getElementById('appId').value = appId;
    if (applicant) document.getElementById('companyName').value = applicant;
    if (project) document.getElementById('projectName').value = project;
    if (reqLoad) document.getElementById('reqLoad').value = reqLoad;

    // 3. Handle Submission
    document.getElementById('submitBtn').addEventListener('click', () => {
        // Simple mock validation
        const authPerson = document.getElementById('authPerson').value;
        const district = document.getElementById('district').value;
        
        if (!authPerson || !district) {
            alert("Please fill in the District and Authorized Person fields.");
            return;
        }

        // Generate Reference Number
        const randomRef = Math.floor(10000 + Math.random() * 90000);
        const refNumber = `ELEC-2026-${randomRef}`;

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
