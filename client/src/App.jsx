import React, { useState } from 'react';
import Header from './components/Header';
import AuthModal from './components/AuthModal';
import OtpVerification from './components/OtpVerification';
import DashboardView from './components/DashboardView';

export default function App() {
  const [stage, setStage] = useState('AUTH'); // 'AUTH', 'OTP', 'DASHBOARD'
  const [user, setUser] = useState(null);
  const [txnData, setTxnData] = useState(null);
  const [identifierType, setIdentifierType] = useState('pan');
  const [identifierValue, setIdentifierValue] = useState('');

  // Handle when OTP is requested from AuthModal
  const handleOtpRequested = (data, type, val) => {
    setTxnData(data);
    setIdentifierType(type);
    setIdentifierValue(val);
    setStage('OTP');
  };

  // Handle when OTP verification succeeds
  const handleVerifySuccess = (authResponse) => {
    setUser(authResponse.user);
    setStage('DASHBOARD');
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    setTxnData(null);
    setStage('AUTH');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header user={user} onLogout={handleLogout} />

      <main style={{ flex: 1, padding: '40px 20px' }}>
        {stage === 'AUTH' && (
          <AuthModal onOtpRequested={handleOtpRequested} />
        )}

        {stage === 'OTP' && (
          <OtpVerification
            txnData={txnData}
            identifierType={identifierType}
            identifierValue={identifierValue}
            onVerifySuccess={handleVerifySuccess}
            onBack={() => setStage('AUTH')}
          />
        )}

        {stage === 'DASHBOARD' && user && (
          <DashboardView user={user} />
        )}
      </main>

      {/* Official Footer */}
      <footer style={{
        background: '#060d1a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: '#64748b'
      }}>
        National Interoperability & Workflow Engine • SIH 2026 Submission • Powered by Node.js & React
      </footer>
    </div>
  );
}
