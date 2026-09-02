import React, { useState, useEffect } from 'react';
import { ShieldCheck, Smartphone, Clock, ArrowRight, RefreshCw, KeyRound, AlertCircle } from 'lucide-react';

export default function OtpVerification({ txnData, identifierType, identifierValue, onVerifySuccess, onBack }) {
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Handle single digit OTP input change
  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    // Auto advance focus
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  // Handle keydown for backspace back-navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  // Helper auto fill demo code
  const autoFillDemoOtp = () => {
    const code = txnData?.demoOtpCode || "654321";
    setOtpDigits(code.split(''));
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length < 6) {
      setErrorMsg('Please enter all 6 digits of the OTP');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnId: txnData.txnId,
          otpCode: fullOtp
        })
      });

      const data = await res.json();
      setLoading(false);

      if (data.success) {
        onVerifySuccess(data);
      } else {
        setErrorMsg(data.message || 'OTP verification failed');
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg('Network error connecting to e-KYC authentication server.');
    }
  };

  return (
    <div className="glass-card" style={{ maxWidth: '480px', margin: '0 auto', padding: '32px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          margin: '0 auto 16px'
        }}>
          <Smartphone size={28} color="#10b981" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'white' }}>
          Simulated Mobile OTP Verification
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '6px' }}>
          Enter the 6-digit verification code sent to registered mobile{' '}
          <strong style={{ color: '#f59e0b' }}>{txnData?.maskedPhone || '98765*****0'}</strong>
        </p>
      </div>

      {/* Demo helper banner */}
      <div style={{
        background: 'rgba(245, 158, 11, 0.12)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '24px',
        fontSize: '0.82rem',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={16} color="#f59e0b" />
          <span>
            Simulated OTP Code: <strong style={{ color: '#f59e0b', fontSize: '0.95rem' }}>{txnData?.demoOtpCode || '654321'}</strong>
          </span>
        </div>
        <button
          onClick={autoFillDemoOtp}
          style={{
            background: 'var(--gov-gold)',
            color: '#0b192c',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 10px',
            fontWeight: 700,
            fontSize: '0.75rem',
            cursor: 'pointer'
          }}
        >
          1-Click Auto Fill
        </button>
      </div>

      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '0.82rem',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {/* OTP Inputs */}
      <form onSubmit={handleVerify}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
          {otpDigits.map((digit, index) => (
            <input
              key={index}
              id={`otp-input-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              style={{
                width: '46px',
                height: '56px',
                fontSize: '1.4rem',
                fontWeight: 700,
                textAlign: 'center',
                background: 'rgba(10, 19, 36, 0.8)',
                border: digit ? '2px solid var(--gov-gold)' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white'
              }}
            />
          ))}
        </div>

        {/* Countdown & Resend */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', fontSize: '0.82rem', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} /> Resend code in: <span style={{ color: 'white', fontWeight: 600 }}>{timer}s</span>
          </div>
          <button
            type="button"
            disabled={timer > 0}
            style={{
              background: 'none',
              border: 'none',
              color: timer > 0 ? '#64748b' : '#38bdf8',
              cursor: timer > 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={12} /> Resend OTP
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button type="button" onClick={onBack} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
            Back
          </button>
          <button type="submit" disabled={loading} className="btn-saffron" style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? (
              <span>Verifying e-KYC...</span>
            ) : (
              <>
                <ShieldCheck size={18} /> Verify e-KYC OTP
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
