// Pollution Department Portal JS

const POLLUTION_API_URL = 'http://localhost:4002/api/pollution';
const API_KEY = 'interop-demo-key-001';

function autofill(appNo, pan, type) {
  document.getElementById('appInput').value = appNo;
  document.getElementById('panInput').value = pan;
  document.getElementById('typeInput').value = type;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  };
}

function showOutage(msg) {
  const alert = document.getElementById('outageAlert');
  alert.innerHTML = `<strong>Service Unavailable (503):</strong> ${msg}`;
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
    const resRaw = await fetch(`${POLLUTION_API_URL}/applications/${appNo}`, { headers: getHeaders() });
    const dataRaw = await resRaw.json();

    if (resRaw.status === 503) {
      return showOutage(dataRaw.message || 'API Outage simulated.');
    }

    if (resRaw.ok) {
      document.getElementById('rawLegacyJson').innerText = JSON.stringify(dataRaw, null, 2);
    } else {
      document.getElementById('rawLegacyJson').innerText = JSON.stringify(dataRaw, null, 2);
    }

    // Fetch canonical
    const resCan = await fetch(`${POLLUTION_API_URL}/applications/${appNo}?schema=canonical`, { headers: getHeaders() });
    const dataCan = await resCan.json();
    if (resCan.ok) {
      document.getElementById('canonicalJson').innerText = JSON.stringify(dataCan, null, 2);
    }
    
    fetchAuditLogs();
  } catch (err) {
    showOutage('Connection refused. Is the Pollution API running on port 4002?');
  }
}

async function handleVerify(e) {
  e.preventDefault();
  const appNo = document.getElementById('appInput').value.trim();
  const pan = document.getElementById('panInput').value.trim();
  const type = document.getElementById('typeInput').value.trim();
  
  document.getElementById('resultsSection').style.display = 'block';
  hideOutage();

  try {
    // 1. Fetch raw record from Department API
    const resRaw = await fetch(`${POLLUTION_API_URL}/applications/${appNo}`, { headers: getHeaders() });
    const dataRaw = await resRaw.json();

    if (resRaw.status === 503) {
      return showOutage(dataRaw.message || 'API Outage simulated.');
    }

    if (!resRaw.ok) {
        return alert(`Error fetching raw record: ${dataRaw.message}`);
    }

    document.getElementById('rawLegacyJson').innerText = JSON.stringify(dataRaw, null, 2);

    // 2. Send to Central Interoperability Engine
    const resInterop = await fetch(`http://localhost:5000/api/interop/verify-dependency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          department: 'POLLUTION', 
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

async function toggleConsent() {
  const appNo = document.getElementById('appInput').value.trim();
  if (!appNo) return alert('Enter an application number first.');

  try {
    const resRaw = await fetch(`${POLLUTION_API_URL}/applications/${appNo}`, { headers: getHeaders() });
    const dataRaw = await resRaw.json();
    if (!resRaw.ok) return alert('Record not found');

    const currentStatus = dataRaw.consent_status;
    let newStatus = 'PENDING';
    if (currentStatus === 'PENDING') newStatus = 'APPROVED';
    if (currentStatus === 'APPROVED') newStatus = 'REJECTED';

    const res = await fetch(`${POLLUTION_API_URL}/applications/${appNo}/consent`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ consent_status: newStatus })
    });
    
    if (res.ok) {
      const pan = document.getElementById('panInput').value.trim();
      if (pan) {
        document.getElementById('pollutionForm').dispatchEvent(new Event('submit'));
      } else {
        handleLookup();
      }
    } else {
      alert('Failed to update consent status');
    }
  } catch (err) {
    alert('Error connecting to API');
  }
}

async function fetchAuditLogs() {
  try {
    const res = await fetch(`${POLLUTION_API_URL}/audit`, { headers: getHeaders() });
    const data = await res.json();
    if (res.ok) {
      const list = document.getElementById('auditLogList');
      list.innerHTML = '';
      data.transactions.slice(0, 5).forEach(log => {
        const item = document.createElement('div');
        item.className = 'audit-row';
        item.innerHTML = `
          <span>[${log.timestamp}] ${log.endpoint} (${log.outcome})</span>
          <span style="color: var(--navy);">${log.transactionId}</span>
        `;
        list.appendChild(item);
      });
    }
  } catch (err) {}
}
