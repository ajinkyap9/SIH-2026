import React from 'react';
import { UserCheck, Sparkles, ArrowRight, Building } from 'lucide-react';

export default function DemoPresetBar({ onSelectPreset }) {
  const presets = [
    {
      title: "ABC Industries Pvt Ltd",
      tag: "Industrial Land #102",
      badgeColor: "#10b981",
      type: "pan",
      value: "ABCDE1234F",
      desc: "Mutation APPROVED • Clear Encumbrance"
    },
    {
      title: "Rajesh Infrastructure",
      tag: "Pending Mutation #103",
      badgeColor: "#f59e0b",
      type: "pan",
      value: "RJSHI5678K",
      desc: "Mutation PENDING • State-Aware Workflow"
    },
    {
      title: "Priya Ramesh Sharma",
      tag: "Citizen e-KYC #104",
      badgeColor: "#3b82f6",
      type: "aadhaar",
      value: "1234-5678-9012",
      desc: "Aadhaar Verified • Encumbered Property"
    }
  ];

  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '28px', borderLeft: '4px solid var(--gov-saffron)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#f59e0b" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white', fontFamily: 'var(--font-heading)' }}>
            Quick Demo Presets for Evaluators
          </h3>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Click any card to auto-fill e-KYC credentials
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        {presets.map((p, idx) => (
          <div
            key={idx}
            className="demo-preset-card"
            onClick={() => onSelectPreset(p.type, p.value)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                {p.title}
              </span>
              <span style={{
                fontSize: '0.68rem',
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: `${p.badgeColor}22`,
                color: p.badgeColor,
                border: `1px solid ${p.badgeColor}55`,
                fontWeight: 600
              }}>
                {p.tag}
              </span>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Building size={13} color="#94a3b8" />
              <strong>{p.type.toUpperCase()}:</strong> {p.value}
            </div>

            <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{p.desc}</span>
              <ArrowRight size={13} color="#f59e0b" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
