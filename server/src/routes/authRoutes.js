import express from 'express';
import { db } from '../db/seedData.js';

const router = express.Router();

// GET /api/auth/demo-users - Return list of sample profiles for easy 1-click hackathon demoing
router.get('/demo-users', (req, res) => {
  res.json({
    success: true,
    users: db.users
  });
});

// POST /api/auth/request-otp - Send simulated SMS OTP for Aadhaar or PAN verification
router.post('/request-otp', (req, res) => {
  const { identifierType, identifierValue } = req.body;

  if (!identifierValue) {
    return res.status(400).json({ success: false, message: 'Aadhaar or PAN identifier is required' });
  }

  const cleanValue = identifierValue.replace(/[\s-]/g, '').toUpperCase();

  // Find user in mock database or generate virtual e-KYC record
  let user = db.users.find(u => 
    (identifierType === 'aadhaar' && u.aadhaar === cleanValue) ||
    (identifierType === 'pan' && u.pan === cleanValue)
  );

  if (!user) {
    // Dynamically generate demo record if user types custom valid-formatted Aadhaar/PAN
    user = {
      id: `USR-TEMP-${Date.now().toString().slice(-4)}`,
      name: identifierType === 'pan' ? 'Apex Dynamics Enterprises' : 'Suresh K. Patel',
      type: identifierType === 'pan' ? 'BUSINESS' : 'INDIVIDUAL',
      pan: identifierType === 'pan' ? cleanValue : 'APXPK9918M',
      aadhaar: identifierType === 'aadhaar' ? cleanValue : '998811223344',
      authorizedPerson: 'Suresh Patel (Applicant)',
      phone: '+91 98765 12345',
      maskedPhone: '98765*****5',
      email: 'applicant@gov-interop.in',
      address: 'Plot 105, Industrial Development Corridor, Maharashtra',
      kycVerified: true,
      digilockerId: `DL-MH-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      registeredLandSurvey: '102'
    };
  }

  const txnId = `TXN-OTP-${Date.now()}`;
  // For demo predictability, use a fixed demo OTP if test user, or generate random 6 digits
  const demoOtpCode = "654321";

  db.activeOtps.set(txnId, {
    otp: demoOtpCode,
    user,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 mins
  });

  // Audit log
  db.auditLogs.push({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    event: 'OTP_REQUESTED',
    identifierType,
    identifierValue: cleanValue.slice(0, 4) + '****' + cleanValue.slice(-2),
    txnId,
    status: 'SUCCESS'
  });

  res.json({
    success: true,
    message: `OTP sent to mobile registered with ${identifierType.toUpperCase()}`,
    txnId,
    maskedPhone: user.maskedPhone,
    demoOtpCode, // Highlighted in demo helper UI for convenient testing!
    expiresInSeconds: 300
  });
});

// POST /api/auth/verify-otp - Verify OTP and complete e-KYC authentication
router.post('/verify-otp', (req, res) => {
  const { txnId, otpCode } = req.body;

  if (!txnId || !otpCode) {
    return res.status(400).json({ success: false, message: 'Transaction ID and OTP code are required' });
  }

  const session = db.activeOtps.get(txnId);

  if (!session) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP session' });
  }

  if (Date.now() > session.expiresAt) {
    db.activeOtps.delete(txnId);
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new code.' });
  }

  if (session.otp !== otpCode.trim()) {
    return res.status(401).json({ success: false, message: 'Incorrect OTP code entered. (Hint: Use 654321 for demo)' });
  }

  // Verification success!
  db.activeOtps.delete(txnId);
  const user = session.user;

  // Generate simulated Auth Token
  const token = `GOV_TOKEN_${user.id}_${Date.now()}`;

  db.auditLogs.push({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    event: 'EKYC_AUTH_SUCCESS',
    userId: user.id,
    digilockerId: user.digilockerId,
    status: 'AUTHENTICATED'
  });

  res.json({
    success: true,
    message: 'DigiLocker e-KYC Verification Successful',
    token,
    user: {
      ...user,
      authenticatedAt: new Date().toISOString()
    }
  });
});

export default router;
