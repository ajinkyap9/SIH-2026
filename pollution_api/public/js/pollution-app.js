document.addEventListener('DOMContentLoaded', () => {
    // 1. Read URL Parameters passed from MAITRI
    const urlParams = new URLSearchParams(window.location.search);
    const appId = urlParams.get('app_id') || 'UNKNOWN-APP';
    const applicant = urlParams.get('applicant') || '';
    const project = urlParams.get('project') || '';
    const industry = urlParams.get('industry') || '';
    const pan = urlParams.get('pan') || '';
    const callbackUrl = urlParams.get('callback');

    // 2. Prefill Form Data
    document.getElementById('appId').value = appId;
    if (applicant) document.getElementById('companyName').value = applicant;
    if (project) document.getElementById('projectName').value = project;
    if (industry) document.getElementById('industryCategory').value = industry;
    if (pan && document.getElementById('pan')) document.getElementById('pan').value = pan.toUpperCase();

    // 3. Handle Application Submission
    document.getElementById('submitBtn').addEventListener('click', async () => {
        // Defaults for required estimates
        const water = document.getElementById('water').value || '5';
        const solidWaste = document.getElementById('solidWaste').value || '10';
        document.getElementById('water').value = water;
        document.getElementById('solidWaste').value = solidWaste;

        const currentComp = document.getElementById('companyName').value || 'Applicant Enterprise';
        const currentPan = (document.getElementById('pan')?.value || pan || 'ABCDE1234F').toUpperCase();

        // Generate Demo Reference Number
        const randomRef = Math.floor(10000 + Math.random() * 90000);
        let refNumber = `MPCB-2026-${randomRef}`;

        // Persist to PostgreSQL backend
        try {
            const res = await fetch('/api/pollution/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationNo: refNumber,
                    industryName: currentComp,
                    industryPan: currentPan,
                    plantLocation: 'MIDC Industrial Area',
                    region: 'Pune',
                    industryType: 'Green / Manufacturing',
                    consentType: 'CTE',
                    airEmissionCategory: 'GREEN'
                })
            });
            const data = await res.json();
            if (data.success && data.application_no) {
                refNumber = data.application_no;
            }
        } catch (e) {
            console.warn('Pollution backend apply note:', e.message);
        }

        // Update UI (Hide form, show success)
        document.getElementById('formCard').style.display = 'none';
        document.getElementById('successCard').style.display = 'block';
        document.getElementById('refNumber').textContent = `MPCB Reference: ${refNumber}`;

        // Configure Return Button
        document.getElementById('returnBtn').addEventListener('click', () => {
            if (callbackUrl) {
                // Determine separator for appending query parameters
                const separator = callbackUrl.includes('?') ? '&' : '?';
                const finalUrl = `${callbackUrl}${separator}pollution_status=COMPLETED&pollution_ref=${refNumber}`;
                
                // Redirect back to MAITRI in this tab
                window.location.href = finalUrl;
            } else {
                alert("No callback URL provided by MAITRI. Closing window.");
                window.close();
            }
        });
    });
});
