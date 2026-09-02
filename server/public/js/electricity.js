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
    // 1. Fetch raw record from Department API
    const resRaw = await fetch(`${ELECTRICITY_API_URL}/applications/${appNo}`, { headers: getHeaders() });
    const dataRaw = await resRaw.json();

    if (resRaw.status === 503) {
      return showOutage(dataRaw.message || dataRaw.detail || 'API Outage simulated.');
    }

    if (!resRaw.ok) {
        return alert(`Error fetching raw record: ${dataRaw.message || dataRaw.detail}`);
    }

    document.getElementById('rawLegacyJson').innerText = JSON.stringify(dataRaw, null, 2);

    // 2. Send to Central Interoperability Engine
    const resInterop = await fetch(`http://localhost:5000/api/interop/verify-dependency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          department: 'ELECTRICITY', 
          rawData: dataRaw, 
          organizationPan: pan 
      })
    });
    
    const data = await resInterop.json();
    
    if (resInterop.ok) {
      document.getElementById('verificationCard').style.display = 'block';
      document.getElementById('canonicalJson').innerText = JSON.stringify(data.canonicalModel, null, 2);
      
      const statusBadge = document.getElementById('dependencyStatus');
      statusBadge.innerText = data.dependencyStatus;
      statusBadge.className = 'tag ' + (
        data.dependencyStatus === 'RESOLVED' ? 'tag-green' : 
        data.dependencyStatus === 'WAITING' ? 'tag-amber' : 'tag-red'
      );

      const checksContainer = document.getElementById('checksList');
      checksContainer.innerHTML = '';
      
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <span>Reasoning</span>
        <span style="font-weight:bold; color: var(--text);">${data.dependencyReason}</span>
      `;
      checksContainer.appendChild(row);
      
    } else {
      alert(`Interop Engine Error: ${data.message}`);
    }
    fetchAuditLogs();
  } catch (err) {
    showOutage('Connection refused or Interop backend unavailable.');
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
    const res = await fetch(`http://localhost:4001/api/audit?limit=5`, { headers: getHeaders() });
    const data = await res.json();
    if (res.ok && Array.isArray(data)) {
      const list = document.getElementById('auditLogList');
      list.innerHTML = '';
      data.forEach(log => {
        const item = document.createElement('div');
        item.className = 'audit-row';
        item.innerHTML = `
          <span>[${log.timestamp || new Date().toISOString()}] ${log.endpoint} (${log.outcome})</span>
          <span style="color: var(--navy);">${log.transaction_id || ''}</span>
        `;
        list.appendChild(item);
      });
    }
  } catch (err) {}
}
