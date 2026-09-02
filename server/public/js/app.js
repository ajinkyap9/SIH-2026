// G2C Citizen Interoperability Gateway — Native Vanilla JavaScript Logic

let currentSession = null;
let currentTxnData = null;

document.addEventListener('DOMContentLoaded', () => {
  initFormListeners();
});

function initFormListeners() {
  const identifierInput = document.getElementById('identifierInput');
  const radioPan = document.getElementById('radioPan');
  const radioAadhaar = document.getElementById('radioAadhaar');
  const authForm = document.getElementById('authForm');

  if (radioPan && radioAadhaar) {
    radioPan.addEventListener('change', () => updateInputPlaceholder());
    radioAadhaar.addEventListener('change', () => updateInputPlaceholder());
  }

  if (identifierInput) {
    identifierInput.addEventListener('input', (e) => {
      const isAadhaar = document.getElementById('radioAadhaar').checked;
      let val = e.target.value;

      if (isAadhaar) {
        // Aadhaar 4-4-4 auto format
        const digits = val.replace(/\D/g, '').slice(0, 12);
        e.target.value = digits.replace(/(\d{4})(?=\d)/g, '$1-');
      } else {
        // PAN uppercase 10 chars
        e.target.value = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
      }
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', handleRequestOtp);
  }
}

function updateInputPlaceholder() {
  const isAadhaar = document.getElementById('radioAadhaar').checked;
  const input = document.getElementById('identifierInput');
  const label = document.getElementById('identifierLabel');
  input.value = '';

  if (isAadhaar) {
    label.innerHTML = 'Enter 12-Digit Citizen Aadhaar Number <span class="req-star">*</span>';
    input.placeholder = 'e.g. 9988-7766-5544';
  } else {
    label.innerHTML = 'Enter 10-Character Citizen PAN Card <span class="req-star">*</span>';
    input.placeholder = 'e.g. RMPTL1234F';
  }
}

// Quick evaluator demo preset filler
function selectDemoPreset(type, value) {
  if (type === 'pan') {
    document.getElementById('radioPan').checked = true;
  } else {
    document.getElementById('radioAadhaar').checked = true;
  }
  updateInputPlaceholder();
  document.getElementById('identifierInput').value = value;
}

// Submit Request OTP
async function handleRequestOtp(e) {
  e.preventDefault();
  const isAadhaar = document.getElementById('radioAadhaar').checked;
  const rawVal = document.getElementById('identifierInput').value;
  const cleanVal = rawVal.replace(/[\s-]/g, '');

  const errorDiv = document.getElementById('authError');
  errorDiv.style.display = 'none';

  if (isAadhaar && cleanVal.length !== 12) {
    showError('Please enter a valid 12-digit Aadhaar number.');
    return;
  }
  if (!isAadhaar && cleanVal.length !== 10) {
    showError('Please enter a valid 10-character PAN number (e.g. RMPTL1234F).');
    return;
  }

  try {
    const res = await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifierType: isAadhaar ? 'aadhaar' : 'pan',
        identifierValue: cleanVal
      })
    });

    const data = await res.json();
    if (data.success) {
      currentTxnData = data;
      openOtpModal(data);
    } else {
      showError(data.message || 'Failed to request OTP');
    }
  } catch (err) {
    showError('Error connecting to backend auth server.');
  }
}

function showError(msg) {
  const errorDiv = document.getElementById('authError');
  errorDiv.innerText = msg;
  errorDiv.style.display = 'block';
}

// OTP Modal Handlers
function openOtpModal(txnData) {
  document.getElementById('otpModal').style.display = 'flex';
  document.getElementById('maskedPhoneSpan').innerText = txnData.maskedPhone;
  document.getElementById('demoOtpCodeSpan').innerText = txnData.demoOtpCode;
  document.getElementById('otpInput').value = '';
  document.getElementById('otpError').style.display = 'none';
}

function closeOtpModal() {
  document.getElementById('otpModal').style.display = 'none';
}

function autoFillOtp() {
  if (currentTxnData?.demoOtpCode) {
    document.getElementById('otpInput').value = currentTxnData.demoOtpCode;
  }
}

async function verifyOtpSubmit() {
  const otpVal = document.getElementById('otpInput').value.trim();
  const otpError = document.getElementById('otpError');
  otpError.style.display = 'none';

  if (otpVal.length < 6) {
    otpError.innerText = 'Please enter the 6-digit OTP code.';
    otpError.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txnId: currentTxnData.txnId,
        otpCode: otpVal
      })
    });

    const data = await res.json();
    if (data.success) {
      currentSession = data.user;
      closeOtpModal();
      showDashboard(data.user);
    } else {
      otpError.innerText = data.message || 'Verification failed';
      otpError.style.display = 'block';
    }
  } catch (err) {
    otpError.innerText = 'Server error during verification.';
    otpError.style.display = 'block';
  }
}

// Render G2C Citizen Interoperability Dashboard View
function showDashboard(user) {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('dashboardSection').style.display = 'block';

  // Render User Card
  document.getElementById('userName').innerText = user.name;
  document.getElementById('userPan').innerText = user.pan;
  document.getElementById('userSurvey').innerText = user.registeredLandSurvey;
  document.getElementById('userAddress').innerText = user.address;
  document.getElementById('userAuthorized').innerText = user.authorizedPerson;

  evaluateProject(user.registeredLandSurvey);
}

async function evaluateProject(surveyNo) {
  const surveyToUse = surveyNo || currentSession.registeredLandSurvey || '101';

  try {
    const res = await fetch('/api/interop/evaluate-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicantPan: currentSession.pan,
        applicantAadhaar: currentSession.aadhaar,
        surveyNumber: surveyToUse
      })
    });

    const data = await res.json();
    if (data.success) {
      renderWorkflowTable(data.workflow);
      document.getElementById('rawLegacyJson').innerText = JSON.stringify(data.rawLegacyPayload, null, 2);
      document.getElementById('canonicalJson').innerText = JSON.stringify(data.canonicalModel, null, 2);
    } else {
      alert(data.message || 'Evaluation error');
    }
  } catch (err) {
    alert('Server communication error');
  }
}

function renderWorkflowTable(workflow) {
  const tbody = document.getElementById('workflowTableBody');
  tbody.innerHTML = '';

  workflow.dependencies.forEach(dep => {
    const tr = document.createElement('tr');
    let statusClass = 'status-waiting';
    if (dep.status === 'RESOLVED') statusClass = 'status-resolved';
    if (dep.status === 'BLOCKED' || dep.status === 'FAILED' || dep.status === 'ACTION_REQUIRED') statusClass = 'status-blocked';

    tr.innerHTML = `
      <td><strong>${dep.title}</strong></td>
      <td>${dep.department}</td>
      <td><span class="status-tag ${statusClass}">${dep.status}</span></td>
      <td style="font-size: 0.8rem; color: #475569;">${dep.reason || 'Citizen prerequisites satisfied'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Interactive Simulation Controls
async function toggleMutationStatus() {
  const surveyNo = currentSession.registeredLandSurvey;
  const currentPayloadText = document.getElementById('rawLegacyJson').innerText;
  let currentJamabandi = 'APPROVED';
  try {
    const parsed = JSON.parse(currentPayloadText);
    currentJamabandi = parsed.jamabandi;
  } catch (e) {}

  const newStatus = currentJamabandi === 'APPROVED' ? 'PENDING' : 'APPROVED';

  await fetch('/api/land/update-mutation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'GOV-INTEROP-SECRET-KEY'
    },
    body: JSON.stringify({ surveyNo, newStatus })
  });

  evaluateProject(surveyNo);
}

async function toggleOutageSimulation() {
  const res = await fetch('/api/land/toggle-outage', { method: 'POST' });
  const data = await res.json();
  alert(data.message);
  evaluateProject(currentSession.registeredLandSurvey);
}

function logout() {
  currentSession = null;
  currentTxnData = null;
  document.getElementById('dashboardSection').style.display = 'none';
  document.getElementById('authSection').style.display = 'block';
  document.getElementById('identifierInput').value = '';
}
