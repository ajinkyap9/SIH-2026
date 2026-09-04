document.addEventListener('DOMContentLoaded', () => {
    // 1. Read URL Parameters passed from MAITRI
    const urlParams = new URLSearchParams(window.location.search);
    const appId = urlParams.get('app_id') || 'UNKNOWN-APP';
    const applicant = urlParams.get('applicant') || '';
    const project = urlParams.get('project') || '';
    const industry = urlParams.get('industry') || '';
    const callbackUrl = urlParams.get('callback');

    // 2. Prefill Form Data
    document.getElementById('appId').value = appId;
    if (applicant) document.getElementById('companyName').value = applicant;
    if (project) document.getElementById('projectName').value = project;
    if (industry) document.getElementById('industryCategory').value = industry;

    // 3. Handle Application Submission
    document.getElementById('submitBtn').addEventListener('click', () => {
        // Simple mock validation
        const water = document.getElementById('water').value;
        const solidWaste = document.getElementById('solidWaste').value;
        
        if (!water || !solidWaste) {
            alert("Please provide Water Consumption and Solid Waste Generation estimates.");
            return;
        }

        // Generate Demo Reference Number
        const randomRef = Math.floor(10000 + Math.random() * 90000);
        const refNumber = `MPCB-2026-${randomRef}`;

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
