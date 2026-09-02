import React, { useState, useEffect } from 'react';
import { ShieldCheck, Building2, Layers, RefreshCw, CheckCircle2, Clock, AlertTriangle, Cpu, Database, Activity, ToggleLeft, ToggleRight, Radio } from 'lucide-react';

export default function DashboardView({ user }) {
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Outage and Mutation Simulation States
  const [isLandOutage, setIsLandOutage] = useState(false);
  const [mutationUpdating, setMutationUpdating] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  // Fetch initial project evaluation when dashboard mounts
  useEffect(() => {
    if (user?.registeredLandSurvey) {
      runEvaluation(user.registeredLandSurvey);
    }
    fetchAuditLogs();
  }, [user]);

  const runEvaluation = async (surveyNo) => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('http://localhost:5000/api/interop/evaluate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicantPan: user.pan || 'ABCDE1234F',
          surveyNumber: surveyNo || user.registeredLandSurvey || '102'
        })
      });

      const data = await res.json();
      setLoading(false);

      if (res.status === 503) {
        setErrorMsg('Land Department API is temporarily unavailable (503 Service Outage). Retrying automatically via circuit breaker.');
        setEvaluation(null);
      } else if (data.success) {
        setEvaluation(data);
      } else {
        setErrorMsg(data.message || 'Evaluation failed');
      }
      fetchAuditLogs();
    } catch (err) {
      setLoading(false);
      setErrorMsg('Network error communicating with Interoperability Engine server.');
    }
  };

  // Toggle Mutation status (PENDING <-> APPROVED) for Land Department simulation
  const handleToggleMutation = async (surveyNo, currentStatus) => {
    const nextStatus = currentStatus === 'APPROVED' ? 'PENDING' : 'APPROVED';
    setMutationUpdating(true);

    try {
      await fetch('http://localhost:5000/api/land/update-mutation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'GOV-INTEROP-SECRET-KEY'
        },
        body: JSON.stringify({ surveyNo, newStatus: nextStatus })
      });
      setMutationUpdating(false);
      runEvaluation(surveyNo);
    } catch (err) {
      setMutationUpdating(false);
    }
  };

  // Toggle Outage simulation
  const handleToggleOutage = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/land/toggle-outage', { method: 'POST' });
      const data = await res.json();
      setIsLandOutage(data.isOutageActive);
      runEvaluation(user.registeredLandSurvey);
    } catch (err) {}
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/interop/audit-logs');
      const data = await res.json();
      if (data.success) setAuditLogs(data.logs.slice(0, 5));
    } catch (err) {}
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px' }}>
      {/* Verified Profile Card Banner */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '28px', borderLeft: '4px solid #10b981' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center'
            }}>
              <Building2 size={28} color="#10b981" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', fontFamily: 'var(--font-heading)' }}>
                  {user.name}
                </h2>
                <span className="ekyc-badge">
                  <ShieldCheck size={14} /> DigiLocker Verified
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                <strong>Authorized Representative:</strong> {user.authorizedPerson} • <strong>Registered Address:</strong> {user.address}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ background: 'rgba(10, 19, 36, 0.6)', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
              <span style={{ color: '#94a3b8' }}>PAN:</span> <strong style={{ color: '#f59e0b' }}>{user.pan}</strong>
            </div>
            <div style={{ background: 'rgba(10, 19, 36, 0.6)', padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem' }}>
              <span style={{ color: '#94a3b8' }}>Target Survey #:</span> <strong style={{ color: '#38bdf8' }}>#{user.registeredLandSurvey}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Simulator Control Toolbar for Judges */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '28px', background: 'rgba(30, 41, 59, 0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700, color: '#f59e0b' }}>
            <Activity size={18} /> Evaluator Interactive Simulation Controls:
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleToggleMutation(user.registeredLandSurvey, evaluation?.rawLegacyPayload?.jamabandi)}
              disabled={mutationUpdating}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <RefreshCw size={14} className={mutationUpdating ? 'spin' : ''} />
              Toggle Jamabandi Mutation Status ({evaluation?.rawLegacyPayload?.jamabandi || 'N/A'})
            </button>

            <button
              onClick={handleToggleOutage}
              className="btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderColor: isLandOutage ? '#ef4444' : 'rgba(255,255,255,0.15)',
                color: isLandOutage ? '#fca5a5' : '#e2e8f0'
              }}
            >
              <Radio size={14} color={isLandOutage ? '#ef4444' : '#10b981'} />
              Simulate 503 Outage ({isLandOutage ? 'ACTIVE' : 'OFF'})
            </button>

            <button onClick={() => runEvaluation(user.registeredLandSurvey)} className="btn-primary" style={{ fontSize: '0.78rem', padding: '6px 14px' }}>
              <RefreshCw size={14} /> Re-evaluate State
            </button>
          </div>
        </div>
      </div>

      {/* Error / Outage Alert */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          padding: '16px',
          borderRadius: '12px',
          marginBottom: '28px',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertTriangle size={24} color="#ef4444" />
          <div>
            <strong>Fault Tolerance & Circuit Breaker Active:</strong> {errorMsg}
          </div>
        </div>
      )}

      {/* Main Grid: Cross-Department Workflow Dependencies */}
      {evaluation && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
          {/* Left Column: Cross-Department Dependency Workflow */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <Layers size={22} color="#f59e0b" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', fontFamily: 'var(--font-heading)' }}>
                Cross-Department Workflow Engine
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {evaluation.workflow.dependencies.map((dep, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(10, 19, 36, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>{dep.title}</span>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      background: dep.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.2)' : dep.status === 'WAITING' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                      color: dep.status === 'RESOLVED' ? '#34d399' : dep.status === 'WAITING' ? '#fbbf24' : '#cbd5e1',
                      border: `1px solid ${dep.status === 'RESOLVED' ? '#10b98155' : dep.status === 'WAITING' ? '#f59e0b55' : '#94a3b855'}`
                    }}>
                      {dep.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '8px' }}>
                    Department: <strong>{dep.department}</strong>
                  </div>
                  {dep.reason && (
                    <div style={{ fontSize: '0.76rem', color: dep.status === 'RESOLVED' ? '#a7f3d0' : '#fde68a', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                      ℹ️ {dep.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Schema Transformation & Canonical Engine */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <Cpu size={22} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', fontFamily: 'var(--font-heading)' }}>
                Schema Transformation & Canonical Model
              </h3>
            </div>

            {/* Side-by-side comparison */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Raw Land Department Legacy JSON (gtn, malak_name, jamabandi)
                </span>
                <pre style={{
                  background: '#070f1e',
                  color: '#fbbf24',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  marginTop: '6px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  {JSON.stringify(evaluation.rawLegacyPayload, null, 2)}
                </pre>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Normalized Canonical Platform Representation
                </span>
                <pre style={{
                  background: '#070f1e',
                  color: '#34d399',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  marginTop: '6px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  {JSON.stringify(evaluation.canonicalModel, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Stream Footer */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Database size={18} color="#94a3b8" />
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>
            Live Machine-to-Machine Audit Trail
          </h4>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {auditLogs.map((log, i) => (
            <div key={i} style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>[{log.timestamp}] EVENT: {log.event || log.outcome} • SURVEY: #{log.surveyNumber || 'N/A'}</span>
              <span style={{ color: '#38bdf8' }}>ID: {log.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
