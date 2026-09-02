// Electricity Department Portal JS

const ELECTRICITY_API_URL = 'http://localhost:4001/api/electricity';
const API_KEY = 'elec_demo_key_101';

function autofill(appNo, pan) {
  document.getElementById('appInput').value = appNo;
  document.getElementById('panInput').value = pan;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  };
}

function showOutage(msg) {
  const alert = document.getElementById('outageAlert');
  alert.innerHTML = `<strong>Service Unavailable (503/Error):</strong> ${msg}`;
  alert.style.display = 'block';
  document.getElementById('verificationCard').style.display = 'none';
  document.getElementById('resultsSection').style.display = 'block';
}

function hideOutage() {
  document.getElementById('outageAlert').style.display = 'none';
}

async function handleLookup() {
  const appNo = document.getElementById('appInput').value.trim();
  if (!appNo) return alert('Enter an application number');
  
  document.getElementById('resultsSection').style.display = 'block';
  hideOutage();
  document.getElementById('verificationCard').style.display = 'none';

  try {
    const resRaw = await fetch(`${ELECTRICITY_API_URL}/applications/${appNo}`, { headers: getHeaders() });
    const dataRaw = await resRaw.json();

    if (!resRaw.ok) {
      return showOutage(dataRaw.message || dataRaw.detail || 'API Outage simulated or not found.');
    }

    document.getElementById('rawLegacyJson').innerText = JSON.stringify(dataRaw, null, 2);
    document.getElementById('canonicalJson').innerText = 'The Electricity API returns the schema directly (no canonical param needed here).';
    
    fetchAuditLogs();
  } catch (err) {
    showOutage('Connection refused. Is the Electricity API running on port 4001?');
  }
}

async function handleVerify(e) {
  e.preventDefault();
  const appNo = document.getElementById('appInput').value.trim();
  const pan = document.getElementById('panInput').value.trim();
  
  document.getElementById('resultsSection').style.display = 'block';
  hideOutage();

  try {
    const res = await fetch(`${ELECTRICITY_API_URL}/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ application_number: appNo, pan: pan })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      return showOutage(data.message || data.detail || 'API Outage simulated or error.');
    }

    document.getElementById('verificationCard').style.display = 'block';
    document.getElementById('rawLegacyJson').innerText = 'Fetched internally by engine...';
    document.getElementById('canonicalJson').innerText = JSON.stringify(data.application, null, 2);
    
    const statusBadge = document.getElementById('dependencyStatus');
    statusBadge.innerText = data.status === 'SUCCESS' ? (data.pan_match ? 'RESOLVED' : 'PAN MISMATCH') : data.status;
    statusBadge.className = 'tag ' + (
      data.pan_match ? 'tag-green' : 'tag-red'
    );

    const checksContainer = document.getElementById('checksList');
    checksContainer.innerHTML = '';
    
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
      <span>PAN Match</span>
      <span style="font-weight:bold; color: ${data.pan_match ? 'var(--success)' : 'var(--danger)'};">${data.pan_match ? 'PASS' : 'FAIL'}</span>
    `;
    checksContainer.appendChild(row);

    fetchAuditLogs();
  } catch (err) {
    showOutage('Connection refused. Is the Electricity API running on port 4001?');
  }
}

async function toggleStatus() {
  const appNo = document.getElementById('appInput').value.trim();
  if (!appNo) return alert('Enter an application number first.');

  try {
    const resRaw = await fetch(`${ELECTRICITY_API_URL}/applications/${appNo}`, { headers: getHeaders() });
    const dataRaw = await resRaw.json();
    if (!resRaw.ok) return alert('Record not found');

    const currentStatus = dataRaw.application_status;
    let newStatus = 'PENDING_DOCUMENT_VERIFICATION';
    if (currentStatus.includes('PENDING') || currentStatus.includes('UNDER')) newStatus = 'APPROVED_READY_FOR_CONNECTION';
    else if (currentStatus.includes('APPROVED')) newStatus = 'REJECTED';

    const res = await fetch(`http://localhost:4001/api/admin/set-state`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ 
        application_number: appNo,
        application_status: newStatus 
      })
    });
    
    if (res.ok) {
      const pan = document.getElementById('panInput').value.trim();
      if (pan) {
        document.getElementById('electricityForm').dispatchEvent(new Event('submit'));
      } else {
        handleLookup();
      }
    } else {
      alert('Failed to update status');
    }
  } catch (err) {
    alert('Error connecting to API');
  }
}

async function fetchAuditLogs() {
  try {
    const res = await fetch(`${ELECTRICITY_API_URL}/audit/logs?limit=5`, { headers: getHeaders() });
    const data = await res.json();
    if (res.ok && data.logs) {
      const list = document.getElementById('auditLogList');
      list.innerHTML = '';
      data.logs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'audit-row';
        item.innerHTML = `
          <span>[${log.timestamp}] ${log.endpoint} (${log.outcome})</span>
          <span style="color: var(--navy);">${log.transaction_id}</span>
        `;
        list.appendChild(item);
      });
    }
  } catch (err) {}
}
