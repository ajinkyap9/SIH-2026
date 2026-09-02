import React from 'react';
import { ShieldCheck, Lock, Globe, Building2, User, LogOut } from 'lucide-react';

export default function Header({ user, onLogout }) {
  return (
    <header style={{ width: '100%' }}>
      {/* Indian Tricolor Accent */}
      <div className="tricolor-stripe"></div>

      {/* Top Official Metadata Bar */}
      <div className="official-gov-bar">
        <div className="gov-badge-mini">
          <span className="pulse-dot"></span>
          <span className="ashoka-emblem-text">
            <strong>GOVERNMENT OF INDIA</strong> | National Single Window System Interoperability Gateway
          </span>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Lock size={12} color="#f59e0b" /> 256-bit AES e-KYC Encrypted
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <Globe size={13} /> English / मराठी
          </span>
        </div>
      </div>

      {/* Main Portal Header */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(17, 31, 56, 0.95) 0%, rgba(10, 19, 36, 0.95) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Emblem Icon / Logo */}
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ff9933 0%, #1e6091 100%)',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            <Building2 size={28} color="#ffffff" />
          </div>
          <div>
            <h1 style={{
              fontSize: '1.35rem',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.3px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              MAITRI Interoperability Platform
              <span style={{
                fontSize: '0.68rem',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                SIH 2026 Core
              </span>
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Cross-Departmental API & Dependency Resolution Layer • Land, Electricity & MPCB Verification
            </p>
          </div>
        </div>

        {/* User Identity / Login state badge */}
        <div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                background: 'rgba(30, 96, 145, 0.3)',
                border: '1px solid rgba(30, 96, 145, 0.6)',
                borderRadius: '8px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div className="ekyc-badge">
                  <ShieldCheck size={14} /> DigiLocker Verified
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{user.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {user.type === 'BUSINESS' ? `PAN: ${user.pan}` : `Aadhaar: ****${user.aadhaar.slice(-4)}`}
                  </div>
                </div>
              </div>
              <button onClick={onLogout} className="btn-secondary" style={{ padding: '8px 12px' }}>
                <LogOut size={16} /> Exit
              </button>
            </div>
          ) : (
            <div className="ekyc-badge" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
              <ShieldCheck size={16} /> Authentic e-KYC Portal
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
