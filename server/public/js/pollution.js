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
    const res = await fetch(`${POLLUTION_API_URL}/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ applicationNo: appNo, pan: pan, industryType: type })
    });
    
    const data = await res.json();
    
    if (res.status === 503) {
      return showOutage(data.message || 'API Outage simulated.');
    }

    if (res.ok) {
      document.getElementById('verificationCard').style.display = 'block';
      document.getElementById('rawLegacyJson').innerText = 'Fetched internally by engine...';
      document.getElementById('canonicalJson').innerText = JSON.stringify(data.canonical, null, 2);
      
      const statusBadge = document.getElementById('dependencyStatus');
      statusBadge.innerText = data.dependency_status;
      statusBadge.className = 'tag ' + (
        data.dependency_status === 'RESOLVED' ? 'tag-green' : 
        data.dependency_status === 'WAITING' ? 'tag-amber' : 'tag-red'
      );

      const checksContainer = document.getElementById('checksList');
      checksContainer.innerHTML = '';
      for (const [key, value] of Object.entries(data.checks)) {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `
          <span>${key}</span>
          <span style="font-weight:bold; color: ${value ? 'var(--success)' : 'var(--danger)'};">${value ? 'PASS' : 'FAIL'}</span>
        `;
        checksContainer.appendChild(row);
      }
    } else {
      alert(`Error: ${data.message}`);
    }
    fetchAuditLogs();
  } catch (err) {
    showOutage('Connection refused. Is the Pollution API running on port 4002?');
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
