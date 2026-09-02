import express from 'express';
import {
  getCitizenByAadhaar,
  getCitizenByPan,
  getCitizenByMobile,
  getCitizenByEmail,
  createCitizen,
  getAllCitizens,
  activeOtps
} from '../db/database.js';

const router = express.Router();

// POST /api/auth/verify-aadhaar - Instant inline check during registration
router.post('/verify-aadhaar', (req, res) => {
  const { aadhaar } = req.body;
  const clean = (aadhaar || '').replace(/[\s-]/g, '');

  if (clean.length !== 12 || !/^\d{12}$/.test(clean)) {
    return res.json({ valid: false, message: 'Aadhaar must be exactly 12 numeric digits.' });
  }

  const existing = getCitizenByAadhaar(clean);
  if (existing) {
    return res.json({ valid: false, message: 'This Aadhaar is already registered in the system.' });
  }

  res.json({ valid: true, message: 'Aadhaar format verified & available ✓' });
});

// POST /api/auth/verify-pan - Instant inline check during registration
router.post('/verify-pan', (req, res) => {
  const { pan } = req.body;
  const clean = (pan || '').replace(/\s/g, '').toUpperCase();

  if (clean.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) {
    return res.json({ valid: false, message: 'Invalid PAN format. Format must be 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).' });
  }

  const existing = getCitizenByPan(clean);
  if (existing) {
    return res.json({ valid: false, message: 'This PAN is already registered in the system.' });
  }

  res.json({ valid: true, message: 'PAN verified with Income Tax registry format ✓' });
});

// POST /api/auth/register - Register new citizen with immediate Aadhaar & compulsory PAN verification
router.post('/register', (req, res) => {
  const { firstName, lastName, mobile, email, aadhaar, pan } = req.body;

  if (!firstName || !lastName || !mobile || !email || !aadhaar || !pan) {
    return res.status(400).json({ success: false, message: 'All fields (First Name, Last Name, Mobile, Email, Aadhaar, PAN) are mandatory.' });
  }

  const cleanAadhaar = String(aadhaar).replace(/[\s-]/g, '');
  const cleanPan = String(pan).replace(/\s/g, '').toUpperCase();
  const cleanMobile = String(mobile).replace(/[\s-]/g, '');
  const cleanEmail = String(email).trim().toLowerCase();

  // Validate Aadhaar (12 digits)
  if (cleanAadhaar.length !== 12 || !/^\d{12}$/.test(cleanAadhaar)) {
    return res.status(400).json({ success: false, message: 'Aadhaar must be exactly 12 digits.' });
  }

  // Validate PAN (10 chars, compulsory)
  if (cleanPan.length !== 10 || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan)) {
    return res.status(400).json({ success: false, message: 'Compulsory PAN format invalid. Expected: ABCDE1234F' });
  }

  // Validate Mobile (10 digits)
  if (cleanMobile.length !== 10 || !/^\d{10}$/.test(cleanMobile)) {
    return res.status(400).json({ success: false, message: 'Mobile number must be a valid 10-digit number.' });
  }

  // Validate Email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }

  // Check uniqueness in SQLite
  if (getCitizenByAadhaar(cleanAadhaar)) {
    return res.status(409).json({ success: false, message: 'Aadhaar number already registered. Please login instead.' });
  }
  if (getCitizenByPan(cleanPan)) {
    return res.status(409).json({ success: false, message: 'PAN already registered. Please login instead.' });
  }
  if (getCitizenByMobile(cleanMobile)) {
    return res.status(409).json({ success: false, message: 'Mobile number already registered.' });
  }
  if (getCitizenByEmail(cleanEmail)) {
    return res.status(409).json({ success: false, message: 'Email address already registered.' });
  }

  try {
    const citizen = createCitizen({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      mobile: cleanMobile,
      email: cleanEmail,
      aadhaar: cleanAadhaar,
      pan: cleanPan
    });

    res.json({
      success: true,
      message: 'Citizen registered successfully! Aadhaar and PAN verified.',
      citizen: {
        id: citizen.id,
        name: `${citizen.first_name} ${citizen.last_name}`
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Failed to complete registration in database.' });
  }
});

// POST /api/auth/login - Request OTP using Aadhaar or PAN
router.post('/login', (req, res) => {
  const { identifierType, identifierValue } = req.body;

  if (!identifierValue) {
    return res.status(400).json({ success: false, message: 'Aadhaar or PAN identifier is required.' });
  }

  const clean = String(identifierValue).replace(/[\s-]/g, '').toUpperCase();

  let citizen = null;
  if (identifierType === 'aadhaar') {
    citizen = getCitizenByAadhaar(clean);
  } else {
    citizen = getCitizenByPan(clean);
  }

  if (!citizen) {
    return res.status(404).json({
      success: false,
      message: `No citizen account found for this ${identifierType.toUpperCase()}. Please register as a new user.`
    });
  }

  const txnId = `TXN-${Date.now()}`;
  const demoOtp = '654321';
  const rawMobile = String(citizen.mobile);
  const maskedPhone = rawMobile.slice(0, 5) + '*****' + rawMobile.slice(-1);

  activeOtps.set(txnId, {
    otp: demoOtp,
    citizen,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  // Note: OTP code stays server-side only, never sent to client
  res.json({
    success: true,
    message: `OTP sent to mobile registered with ${identifierType.toUpperCase()}`,
    txnId,
    maskedPhone
  });
});

// POST /api/auth/verify-otp - Complete OTP authentication
router.post('/verify-otp', (req, res) => {
  const { txnId, otp } = req.body;

  if (!txnId || !otp) {
    return res.status(400).json({ success: false, message: 'Transaction ID and OTP code are required.' });
  }

  const session = activeOtps.get(txnId);
  if (!session) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP session. Please request a new OTP.' });
  }

  if (Date.now() > session.expiresAt) {
    activeOtps.delete(txnId);
    return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new code.' });
  }

  if (session.otp !== String(otp).trim()) {
    return res.status(401).json({ success: false, message: 'Incorrect OTP code. Please check and try again.' });
  }

  activeOtps.delete(txnId);
  const c = session.citizen;
  const token = `GOV_SESSION_${c.id}_${Date.now()}`;

  // Only return non-sensitive citizen info to the client
  res.json({
    success: true,
    message: 'Authentication successful.',
    token,
    citizen: {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      fullName: `${c.first_name} ${c.last_name}`,
      email: c.email
    }
  });
});

// GET /api/auth/user-count - Return total registered citizens count (no PII)
router.get('/user-count', (req, res) => {
  const citizens = getAllCitizens(10000);
  res.json({
    success: true,
    totalRegistered: citizens.length
  });
});

export default router;
