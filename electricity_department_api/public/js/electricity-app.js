/**
 * Electricity Distribution Department portal (simulated) — client controller.
 * Same structure as the Land portal (land-app.js): zone picker, cascading
 * district -> taluka filters, document-style result sheets, and the Samanvay
 * hand-off (arrive pre-filled, submit, return with electricity_status=COMPLETED).
 *
 * Talks only to this department's own API (same origin), plus Samanvay's
 * profile endpoint for auto-fill when opened from Samanvay.
 */

const API = '/api/electricity';
const SAMANVAY_PORTAL_API = 'http://localhost:5000/api/portal';

let zones = [];
let currentZone = 'pune';
let lastApplicationRef = '';

const handoff = (() => {
  const p = new URLSearchParams(window.location.search);
  return {
    appId: p.get('app_id'),
    callback: p.get('callback'),
    pan: (p.get('pan') || '').toUpperCase(),
    applicant: p.get('applicant') || '',
    load: p.get('req_load') || '',
  };
})();

// ── Small helpers ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Department status value -> chip. Only statuses the department actually stores.
const STATUS_CHIPS = {
  APPROVED: ['ok', 'मंजूर (Approved)'],
  COMPLETED: ['ok', 'पूर्ण (Completed)'],
  INSTALLED: ['ok', 'बसवले (Installed)'],
  ENERGIZED: ['ok', 'वीजपुरवठा सुरू (Energised)'],
  PAID: ['ok', 'भरले (Paid)'],
  WAIVED: ['ok', 'माफ (Waived)'],
  PENDING: ['wait', 'प्रलंबित (Pending)'],
  SUBMITTED: ['wait', 'अर्ज प्राप्त (Submitted)'],
  UNDER_SCRUTINY: ['wait', 'छाननी सुरू (Under scrutiny)'],
  UNDER_INSPECTION: ['wait', 'तपासणी सुरू (Under inspection)'],
  IN_PROGRESS: ['wait', 'काम सुरू (In progress)'],
  REJECTED: ['bad', 'नामंजूर (Rejected)'],
  FAILED: ['bad', 'अयशस्वी (Failed)'],
  NOT_INSTALLED: ['info', 'बसवले नाही (Not installed)'],
  NOT_CONNECTED: ['info', 'जोडणी नाही (Not connected)'],
  NOT_REQUIRED: ['info', 'आवश्यक नाही (Not required)'],
};
function chip(status) {
  const [kind, label] = STATUS_CHIPS[status] || ['info', status || '—'];
  return `<span class="pt-chip pt-chip--${kind}">${esc(label)}</span>`;
}
const STAGE_STATE = {
  done: ['ok', 'पूर्ण (Done)'],
  current: ['wait', 'सध्या सुरू (In progress)'],
  pending: ['info', 'बाकी (Not yet)'],
  failed: ['bad', 'अयशस्वी / नामंजूर (Failed)'],
  not_required: ['info', 'आवश्यक नाही (Not required)'],
};

async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.detail || `HTTP ${res.status}`);
  return data;
}

// ── Init ────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadZones();
  switchTab('track');
  presetTrack('ELEC-2026-00101');
  showApplyCategory();
  if (handoff.appId) startSamanvayHandoff();
});

// ── Zones / cascading filters ───────────────────────────────────────────────────
async function loadZones() {
  try {
    zones = (await getJSON(`${API}/portal/zones`)).zones || [];
  } catch (err) {
    $('zoneGrid').innerHTML = `<div class="pt-msg pt-msg--bad">परिमंडळे लोड झाली नाहीत (Could not load zones): ${esc(err.message)}</div>`;
    return;
  }
  renderZones();
  populateDistricts();
}

function renderZones() {
  $('zoneGrid').innerHTML = zones.map((z) => `
    <div class="mb-division-card ${z.id === currentZone ? 'selected' : ''}" role="button" tabindex="0"
         onclick="selectZone('${z.id}')" onkeydown="if(event.key==='Enter')selectZone('${z.id}')">
      <div class="mb-division-name">${esc(z.name_mr)}</div>
      <div class="mb-division-sub">${esc(z.name_en)} (${z.circles.length} मंडळे)</div>
    </div>`).join('');
}

function selectZone(id) {
  currentZone = id;
  renderZones();
  populateDistricts();
  if ($('section-register').style.display !== 'none') loadRegister();
}

function zoneCircles() {
  const z = zones.find((x) => x.id === currentZone) || zones[0];
  return z ? z.circles : [];
}

function populateDistricts() {
  const sel = $('selDistrict');
  sel.innerHTML = `<option value="">— सर्व मंडळे (All circles) —</option>` +
    zoneCircles().map((c) => `<option value="${esc(c.name_en)}">${esc(c.name_mr)} (${esc(c.name_en)})</option>`).join('');
  onDistrictChange();
}

function onDistrictChange() {
  const circle = zoneCircles().find((c) => c.name_en === $('selDistrict').value);
  $('selTaluka').innerHTML = `<option value="">— सर्व विभाग (All divisions) —</option>` +
    (circle ? circle.divisions.map((d) => `<option value="${esc(d.name_en)}">${esc(d.name_mr)} (${esc(d.name_en)})</option>`).join('') : '');
}

// ── Tabs ────────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.mb-nav a').forEach((a) => a.classList.remove('active'));
  const nav = $(`nav-${tab}`);
  if (nav) nav.classList.add('active');
  ['track', 'consumer', 'guide', 'register', 'apply'].forEach((t) => {
    $(`section-${t}`).style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'register') loadRegister();
}

// ── Application status ──────────────────────────────────────────────────────────
function presetTrack(appNo) {
  document.querySelector('input[name="trackType"][value="application"]').checked = true;
  $('selDistrict').value = '';
  onDistrictChange();
  $('trackQuery').value = appNo;
  handleTrack();
}

async function handleTrack(e) {
  if (e) e.preventDefault();
  const type = document.querySelector('input[name="trackType"]:checked').value;
  const query = $('trackQuery').value.trim();
  const out = $('resultTrack');
  if (!query) return;
  out.innerHTML = `<div class="pt-msg pt-msg--info">⏳ शोधत आहे… (Searching…)</div>`;
  const params = new URLSearchParams({ search_type: type, query });
  if ($('selDistrict').value) params.set('district', $('selDistrict').value);
  if ($('selTaluka').value) params.set('taluka', $('selTaluka').value);
  try {
    const data = await getJSON(`${API}/portal/applications?${params}`);
    if (!data.results.length) {
      out.innerHTML = `<div class="pt-msg pt-msg--bad">कोणताही अर्ज सापडला नाही (No application found for “${esc(query)}”${$('selDistrict').value ? ' in ' + esc($('selDistrict').value) : ''}).</div>`;
    } else if (data.results.length === 1) {
      await showTracker(data.results[0].application_number);
    } else {
      out.innerHTML = `<div class="mb-card"><div class="mb-card-header"><span>${data.results.length} अर्ज सापडले (applications found)</span></div>
        <div class="mb-card-body pt-table-wrap">${applicationsTable(data.results)}</div></div>`;
    }
  } catch (err) {
    out.innerHTML = `<div class="pt-msg pt-msg--bad">❌ त्रुटी (Error): ${esc(err.message)}</div>`;
  }
}

function applicationsTable(rows) {
  return `<table class="pt-table"><thead><tr>
      <th>अर्ज क्र. (Application)</th><th>अर्जदार (Applicant)</th><th>ठिकाण (Location)</th>
      <th>भार (Load)</th><th>स्थिती (Status)</th><th></th></tr></thead><tbody>
    ${rows.map((a) => `<tr>
      <td class="pt-mono">${esc(a.application_number)}</td>
      <td>${esc(a.applicant_name)}<br><span class="pt-mono" style="font-size:0.8rem;color:#666">${esc(a.applicant_pan)}</span></td>
      <td>${esc(a.village)}, ${esc(a.taluka)}<br><span style="font-size:0.8rem;color:#666">${esc(a.district)}</span></td>
      <td>${esc(a.requested_load)}<br><span style="font-size:0.8rem;color:#666">${esc(a.supply_category)}</span></td>
      <td>${chip(a.application_status)}</td>
      <td><button type="button" class="pt-link-btn" onclick="switchTab('track'); showTracker('${esc(a.application_number)}')">पहा (View)</button></td>
    </tr>`).join('')}</tbody></table>`;
}

async function showTracker(appNo) {
  const out = $('resultTrack');
  try {
    const { application: a, stages } = await getJSON(`${API}/portal/applications/${encodeURIComponent(appNo)}/tracker`);
    const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN') : '—');
    out.innerHTML = `
      <div class="pt-sheet">
        <div class="pt-sheet-watermark">वीज वितरण विभाग</div>
        <div class="pt-sheet-head">
          <h2>नवीन वीज जोडणी अर्ज — पोचपावती व प्रगती</h2>
          <h3>New Connection Application — Acknowledgement &amp; Progress</h3>
          <div class="pt-ref">अर्ज क्र. (Application No): <strong>${esc(a.application_number)}</strong> &nbsp; ${chip(a.application_status)}</div>
        </div>
        <div class="pt-kv">
          <div><strong>अर्जदार (Applicant)</strong>${esc(a.applicant_name)}</div>
          <div><strong>पॅन (PAN)</strong><span class="pt-mono">${esc(a.applicant_pan)}</span></div>
          <div><strong>ठिकाण (Premises)</strong>${esc(a.village)}, ${esc(a.taluka)}, ${esc(a.district)}</div>
          <div><strong>पुरवठा प्रकार (Supply category)</strong>${esc(a.supply_category)} · ${esc(a.connection_type)}</div>
          <div><strong>मागितलेला भार (Requested load)</strong>${esc(a.requested_load)}</div>
          <div><strong>मंजूर भार (Sanctioned load)</strong>${a.application_status === 'APPROVED' ? esc(a.sanctioned_load) : '— (अजून मंजूर नाही / not sanctioned yet)'}</div>
          <div><strong>ग्राहक क्र. (Consumer No)</strong>${a.consumer_number ? `<span class="pt-mono">${esc(a.consumer_number)}</span>` : '— (जोडणीनंतर मिळेल / issued on connection)'}</div>
          <div><strong>थकबाकी (Outstanding dues)</strong>${a.outstanding_dues ? '<span class="pt-chip pt-chip--bad">होय (Yes)</span>' : '<span class="pt-chip pt-chip--ok">नाही (No)</span>'}</div>
          <div><strong>अर्ज दिनांक (Applied on)</strong>${fmt(a.application_date)}</div>
          <div><strong>शेवटचा बदल (Last updated)</strong>${fmt(a.last_updated)}</div>
        </div>
        <ol class="pt-track" aria-label="Application progress">
          ${stages.map((s) => {
            const [kind, label] = STAGE_STATE[s.state] || ['info', s.state];
            return `<li class="pt-step pt-step--${esc(s.state)}">
              <div class="pt-step-title">${esc(s.mr)}</div><div class="pt-step-en">${esc(s.en)}</div>
              <div class="pt-step-state"><span class="pt-chip pt-chip--${kind}">${esc(label)}</span></div>
              ${s.detail ? `<div class="pt-step-detail">${esc(s.detail)}</div>` : ''}
            </li>`;
          }).join('')}
        </ol>
        ${a.rejection_reason ? `<div class="pt-note pt-note--bad"><strong>नामंजुरीचे कारण (Reason for rejection):</strong> ${esc(a.rejection_reason)}</div>` : ''}
        ${a.objection_reason ? `<div class="pt-note"><strong>हरकत (Objection):</strong> ${esc(a.objection_reason)}</div>` : ''}
        ${a.outstanding_dues && a.connection_status !== 'ENERGIZED' ? `<div class="pt-note pt-note--bad"><strong>कृती आवश्यक (Action needed):</strong> थकबाकी भरल्याशिवाय वीजपुरवठा सुरू होणार नाही. (Supply is not energised until outstanding dues are cleared.)</div>` : ''}
        <div class="pt-sign">
          <span>हा संगणकीकृत अहवाल आहे; स्वाक्षरीची आवश्यकता नाही. (Computer-generated; no signature required.)</span>
          <button type="button" class="mb-btn mb-btn-outline no-print" onclick="window.print()">🖨️ प्रिंट (Print)</button>
        </div>
      </div>`;
  } catch (err) {
    out.innerHTML = `<div class="pt-msg pt-msg--bad">❌ ${esc(err.message)}</div>`;
  }
}

// ── Consumer connection ─────────────────────────────────────────────────────────
function presetConsumer(type, value) {
  document.querySelector(`input[name="consType"][value="${type}"]`).checked = true;
  $('consQuery').value = value;
  handleConsumer();
}

async function handleConsumer(e) {
  if (e) e.preventDefault();
  const type = document.querySelector('input[name="consType"]:checked').value;
  const query = $('consQuery').value.trim();
  const out = $('resultConsumer');
  if (!query) return;
  try {
    const { results } = await getJSON(`${API}/portal/connections?${new URLSearchParams({ search_type: type, query })}`);
    if (!results.length) {
      out.innerHTML = `<div class="pt-msg pt-msg--bad">कोणतीही जोडणी सापडली नाही (No connection found for “${esc(query)}”).</div>`;
      return;
    }
    out.innerHTML = results.map((c) => `
      <div class="pt-sheet">
        <div class="pt-sheet-watermark">ग्राहक तपशील</div>
        <div class="pt-sheet-head">
          <h2>ग्राहक जोडणी तपशील</h2><h3>Consumer Connection Details</h3>
          <div class="pt-ref">ग्राहक क्र. (Consumer No): <strong>${esc(c.consumer_number)}</strong> &nbsp; ${chip(c.connection_status)}</div>
        </div>
        <div class="pt-kv">
          <div><strong>ग्राहकाचे नाव (Consumer)</strong>${esc(c.applicant_name)}</div>
          <div><strong>पॅन (PAN)</strong><span class="pt-mono">${esc(c.applicant_pan)}</span></div>
          <div><strong>पत्ता (Premises)</strong>${esc(c.premises_address)}</div>
          <div><strong>पुरवठा प्रकार (Supply category)</strong>${esc(c.supply_category)} · ${esc(c.connection_type)}</div>
          <div><strong>मंजूर भार (Sanctioned load)</strong>${esc(c.sanctioned_load)}</div>
          <div><strong>मीटर (Meter)</strong><span class="pt-mono">${esc(c.meter_number || '—')}</span> ${chip(c.meter_status)}</div>
          <div><strong>मूळ अर्ज (Application)</strong><span class="pt-mono">${esc(c.application_number || '—')}</span></div>
          <div><strong>वीजपुरवठा सुरू दिनांक (Energised on)</strong>${c.energization_date ? new Date(c.energization_date).toLocaleDateString('en-IN') : '—'}</div>
          <div><strong>थकबाकी (Outstanding dues)</strong>${c.outstanding_dues ? '<span class="pt-chip pt-chip--bad">होय (Yes)</span>' : '<span class="pt-chip pt-chip--ok">नाही (No)</span>'}</div>
        </div>
      </div>`).join('');
  } catch (err) {
    out.innerHTML = `<div class="pt-msg pt-msg--bad">❌ ${esc(err.message)}</div>`;
  }
}

// ── Load & supply guide ─────────────────────────────────────────────────────────
async function handleGuide(e) {
  if (e) e.preventDefault();
  const out = $('resultGuide');
  try {
    const g = await getJSON(`${API}/portal/supply-guide?load_kw=${encodeURIComponent($('guideLoad').value)}`);
    out.innerHTML = `
      <div class="pt-sheet" style="margin-top: 16px;">
        <div class="pt-sheet-head"><h2>${esc(g.category_mr)}</h2><h3>${esc(g.category_en)} · ${esc(g.load_kw)} kW</h3></div>
        <div class="pt-note">${esc(g.note_mr)}<br><span style="color:#555">${esc(g.note_en)}</span></div>
        <h4 style="margin: 14px 0 6px; color: var(--mb-maroon);">आवश्यक कागदपत्रे (Documents required)</h4>
        <ol style="padding-left: 22px; font-size: 0.9rem; display: grid; gap: 4px;">
          ${g.documents.map((d) => `<li>${esc(d.mr)} <span style="color:#666">(${esc(d.en)})</span></li>`).join('')}
        </ol>
      </div>`;
  } catch (err) {
    out.innerHTML = `<div class="pt-msg pt-msg--bad">❌ ${esc(err.message)}</div>`;
  }
}

// ── Register ────────────────────────────────────────────────────────────────────
async function loadRegister() {
  const out = $('resultRegister');
  out.innerHTML = `<div class="pt-empty">⏳ लोड होत आहे… (Loading…)</div>`;
  try {
    const circles = zoneCircles().map((c) => c.name_en.toLowerCase());
    const { results } = await getJSON(`${API}/portal/applications?search_type=all`);
    const rows = results.filter((a) => circles.includes(String(a.district).toLowerCase()));
    const zone = zones.find((z) => z.id === currentZone);
    out.innerHTML = `<p style="font-size:0.88rem;color:var(--mb-text-muted);margin-bottom:10px;">
        ${esc(zone ? zone.name_mr + ' (' + zone.name_en + ')' : '')} — ${rows.length} अर्ज (applications). इतर परिमंडळ निवडण्यासाठी वरील कार्डवर क्लिक करा.</p>
      ${rows.length ? `<div class="pt-table-wrap">${applicationsTable(rows)}</div>` : '<div class="pt-empty">या परिमंडळात अर्ज नाहीत (No applications in this zone).</div>'}`;
  } catch (err) {
    out.innerHTML = `<div class="pt-msg pt-msg--bad">❌ ${esc(err.message)}</div>`;
  }
}

// ── Apply ───────────────────────────────────────────────────────────────────────
function showApplyCategory() {
  const kw = parseFloat($('applyLoad').value) || 0;
  $('applyCategory').innerHTML = kw >= 100
    ? `⚡ <strong>उच्च दाब (HT) जोडणी</strong> — १०० kW किंवा अधिक भारासाठी व्यवहार्यता तपासणी होईल. (High-tension connection; a feasibility check applies.)`
    : `🔌 <strong>लघु दाब (LT) जोडणी</strong> — १०० kW पेक्षा कमी भार. (Low-tension connection.)`;
}

async function handleApply(e) {
  e.preventDefault();
  const btn = $('btnApply');
  const msg = $('applyMsg');
  btn.disabled = true;
  msg.innerHTML = `<div class="pt-msg pt-msg--info">⏳ अर्ज दाखल करत आहे… (Submitting…)</div>`;
  try {
    const data = await getJSON(`${API}/public-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicant_name: $('applyName').value.trim(),
        applicant_pan: $('applyPan').value.trim().toUpperCase(),
        district: $('applyDistrict').value.trim(),
        taluka: $('applyTaluka').value.trim(),
        village: $('applyVillage').value.trim(),
        address: $('applyAddress').value.trim() || undefined,
        requested_load: $('applyLoad').value,
      }),
    });
    lastApplicationRef = data.application_number || '';
    msg.innerHTML = `<div class="pt-msg pt-msg--ok"><strong>✅ अर्ज दाखल झाला (Application submitted)</strong><br>
      अर्ज क्र. (Application No): <strong class="pt-mono">${esc(data.application_number)}</strong> ·
      विभागाने नोंदवलेली स्थिती (Status recorded by the department): ${chip(data.status)}
      <br><button type="button" class="pt-link-btn" style="margin-top:8px" onclick="switchTab('track'); showTracker('${esc(data.application_number)}')">प्रगती पहा (View progress)</button></div>`;
    if (handoff.appId) {
      const back = $('returnToSamanvay');
      back.hidden = false;
      back.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (err) {
    msg.innerHTML = `<div class="pt-msg pt-msg--bad">❌ अर्ज दाखल झाला नाही (Could not submit): ${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

// ── Samanvay hand-off ───────────────────────────────────────────────────────────
function startSamanvayHandoff() {
  switchTab('apply');
  if (handoff.pan) $('applyPan').value = handoff.pan;
  if (handoff.applicant) $('applyName').value = handoff.applicant;
  if (handoff.load && parseFloat(handoff.load) > 0) $('applyLoad').value = parseFloat(handoff.load);
  showApplyCategory();
  $('samanvayHandoff').hidden = false;
  if (handoff.pan) fillProfileFromSamanvay(handoff.pan);
}

async function fillProfileFromSamanvay(pan) {
  const msg = $('samanvayProfileMsg');
  msg.textContent = '🔄 समन्वय मधून प्रोफाइल आणत आहे… (Fetching your profile from Samanvay…)';
  try {
    const data = await getJSON(`${SAMANVAY_PORTAL_API}/user-profile?pan=${encodeURIComponent(pan)}`);
    if (data.success && data.found && data.profile) {
      const p = data.profile;
      $('applyName').value = p.organization_name || p.full_name || $('applyName').value;
      if (p.pan) $('applyPan').value = p.pan;
      msg.textContent = `✅ प्रोफाइल भरले: ${p.organization_name || p.full_name} (Profile filled — you can edit any field)`;
    } else {
      msg.textContent = '⚠️ या पॅनसाठी प्रोफाइल सापडले नाही — कृपया माहिती स्वतः भरा. (No profile found for this PAN — please fill in manually.)';
    }
  } catch (err) {
    msg.textContent = '⚠️ समन्वयशी जोडणी झाली नाही — कृपया माहिती स्वतः भरा. (Could not reach Samanvay — please fill in manually.)';
  }
}

function returnToSamanvay() {
  const ref = lastApplicationRef || ('ELEC-' + Date.now().toString().slice(-6));
  if (!handoff.callback) { window.location.href = 'http://localhost:5000/dashboard.html?tab=flowchart'; return; }
  // Same contract as before: Samanvay's callback already carries land_status; we add ours.
  const sep = handoff.callback.includes('?') ? '&' : '?';
  const url = `${handoff.callback}${sep}electricity_status=COMPLETED&electricity_ref=${encodeURIComponent(ref)}`;
  if (window.opener && !window.opener.closed) {
    window.opener.location.href = url;
    window.close();
  } else {
    window.location.href = url;
  }
}
