import React, { useState } from 'react';
import { CreditCard, Fingerprint, ShieldCheck, ArrowRight, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import DemoPresetBar from './DemoPresetBar';

export default function AuthModal({ onOtpRequested }) {
  const [activeTab, setActiveTab] = useState('pan'); // 'pan' or 'aadhaar'
  const [identifierValue, setIdentifierValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle Preset selection from evaluator panel
  const handleSelectPreset = (type, val) => {
    setActiveTab(type);
    setIdentifierValue(val);
    setErrorMsg('');
  };

  // Input Formatting & Validation
  const handleInputChange = (e) => {
    const val = e.target.value;
    setErrorMsg('');

    if (activeTab === 'aadhaar') {
      // Clean digits & format 4-4-4
      const digits = val.replace(/\D/g, '').slice(0, 12);
      const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1-');
      setIdentifierValue(formatted);
    } else {
      // PAN formatting uppercase 10 chars
      const cleaned = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase();
      setIdentifierValue(cleaned);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const cleanValue = identifierValue.replace(/[\s-]/g, '');

    if (activeTab === 'aadhaar' && cleanValue.length !== 12) {
      setErrorMsg('Please enter a valid 12-digit Aadhaar Number');
      return;
    }
    if (activeTab === 'pan' && cleanValue.length !== 10) {
      setErrorMsg('Please enter a valid 10-character PAN Number (e.g. ABCDE1234F)');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('http://localhost:5000/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifierType: activeTab,
          identifierValue: cleanValue
        })
      });

      const data = await res.json();
      setLoading(false);

      if (data.success) {
        onOtpRequested(data, activeTab, identifierValue);
      } else {
        setErrorMsg(data.message || 'Failed to request OTP');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg('Error connecting to backend auth server. Please check if server is running on port 5000.');
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      {/* Evaluator Quick Demo Presets */}
      <DemoPresetBar onSelectPreset={handleSelectPreset} />

      {/* Main Auth Card */}
      <div className="glass-card" style={{ padding: '36px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
        {/* Card Title */}
        <div style={{ marginBottom: '24px', textIndent: '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ShieldCheck size={22} color="#f59e0b" />
            <h2 style={{ fontSize: '1.45rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'white' }}>
              Government Authorized e-KYC Verification
            </h2>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Authenticate your identity or corporate entity using Aadhaar e-KYC or Business PAN to access the cross-departmental interoperability portal.
          </p>
        </div>

        {/* Auth Method Tabs */}
        <div className="auth-tab-group">
          <button
            type="button"
            className={`auth-tab ${activeTab === 'pan' ? 'active' : ''}`}
            onClick={() => { setActiveTab('pan'); setIdentifierValue(''); setErrorMsg(''); }}
          >
            <CreditCard size={18} /> Business / Industrial PAN
          </button>
          <button
            type="button"
            className={`auth-tab ${activeTab === 'aadhaar' ? 'active' : ''}`}
            onClick={() => { setActiveTab('aadhaar'); setIdentifierValue(''); setErrorMsg(''); }}
          >
            <Fingerprint size={18} /> Aadhaar e-KYC
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        {/* Main Input Form */}
        <form onSubmit={handleRequestOtp}>
          <div className="input-group">
            <label className="input-label" htmlFor="gov-identifier-input">
              {activeTab === 'pan' ? 'Enter 10-Character Permanent Account Number (PAN)' : 'Enter 12-Digit Aadhaar Number'}
            </label>

            <div style={{ position: 'relative' }}>
              <input
                id="gov-identifier-input"
                type="text"
                className="text-input"
                placeholder={activeTab === 'pan' ? 'e.g. ABCDE1234F' : 'e.g. 9988-7766-5544'}
                value={identifierValue}
                onChange={handleInputChange}
                autoComplete="off"
              />
              {identifierValue && (
                <div style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#10b981',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}>
                  <CheckCircle2 size={16} /> Ready
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} color="#f59e0b" />
              <span>Directly verified against UIDAI / Income Tax simulated registry via DigiLocker</span>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-saffron" style={{ width: '100%', justifyContent: 'center', marginTop: '12px', padding: '14px' }}>
            {loading ? (
              <span>Connecting to e-KYC Gateway...</span>
            ) : (
              <>
                <span>Get SMS OTP Verification Code</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Security assurance footer */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          color: '#94a3b8'
        }}>
          <div>
            Official Partner Portals: <strong>DigiLocker • MAITRI • Aaple Sarkar</strong>
          </div>
          <div>
            Zero Data Storage Guarantee
          </div>
        </div>
      </div>
    </div>
  );
}
