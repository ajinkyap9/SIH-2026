import express from 'express';
import { getApplicationById, createFeedback } from '../db/database.js';

const router = express.Router();

// POST /api/portal/status-check - Check status by Application ID or Survey Number
router.post('/status-check', (req, res) => {
  const { appId } = req.body;
  if (!appId) {
    return res.status(400).json({ success: false, message: 'Application ID or Survey Number is required.' });
  }

  const cleanId = appId.trim();
  const app = getApplicationById(cleanId);

  if (!app) {
    // Generate a structured fallback record if demo ID format entered
    return res.json({
      success: true,
      found: false,
      message: `No active record found for '${cleanId}'. Please check your Application Reference Number or try demo IDs: APP-MH-2026-101, APP-MH-2026-102, APP-MH-2026-103.`,
      demoIds: ['APP-MH-2026-101', 'APP-MH-2026-102', 'APP-MH-2026-103', 'APP-MH-2026-104', 'APP-MH-2026-105']
    });
  }

  res.json({
    success: true,
    found: true,
    application: {
      appId: app.app_id,
      citizenName: app.citizen_name,
      serviceType: app.service_type,
      surveyNumber: app.survey_number,
      status: app.status,
      department: app.department,
      remarks: app.remarks,
      createdAt: app.created_at,
      updatedAt: app.updated_at
    }
  });
});

// POST /api/portal/feedback - Submit feedback or grievance
router.post('/feedback', (req, res) => {
  const { name, email, category, rating, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
  }

  try {
    createFeedback({
      name: name.trim(),
      email: email.trim(),
      category: category || 'GENERAL',
      rating: parseInt(rating, 10) || 5,
      message: message.trim()
    });

    res.json({
      success: true,
      message: 'Thank you for your feedback! Your reference ticket has been logged successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to record feedback.' });
  }
});

// POST /api/portal/process-wizard - Investor/Citizen Process Wizard (MAITRI Question-based microservices recommendation)
router.post('/process-wizard', (req, res) => {
  const { projectType, landAcquired, powerRequired, envCategory, investmentRange } = req.body;

  // Question-based decision logic (matching MAITRI Investor Wizard / RAG specifications)
  const recommendedServices = [];
  const prerequisites = [];

  // Land recommendation
  if (landAcquired === 'yes') {
    recommendedServices.push({
      code: 'LAND-VERIFY',
      title: '7/12 Land Mutation & Title Deed Verification',
      department: 'Revenue & Land Settlement Department',
      authority: 'Govt. of Maharashtra',
      turnaroundDays: 7,
      priority: 'PREREQUISITE_STAGE_1'
    });
    prerequisites.push('Valid Survey / Gat Number and 7/12 extract');
  } else {
    recommendedServices.push({
      code: 'MIDC-ALLOT',
      title: 'MIDC Industrial Plot Allotment & Land Leasing',
      department: 'Maharashtra Industrial Development Corporation (MIDC)',
      authority: 'MIDC Directorate',
      turnaroundDays: 21,
      priority: 'PREREQUISITE_STAGE_1'
    });
    prerequisites.push('Detailed Project Report (DPR) and financial net worth declaration');
  }

  // Environment / Pollution recommendation
  if (envCategory === 'red' || envCategory === 'orange') {
    recommendedServices.push({
      code: 'MPCB-CTE',
      title: 'Consent to Establish (CTE) under Water & Air Acts',
      department: 'Maharashtra Pollution Control Board (MPCB)',
      authority: 'MPCB Environment Wing',
      turnaroundDays: 14,
      priority: 'PREREQUISITE_STAGE_2'
    });
    prerequisites.push('Land ownership verification / MIDC lease deed');
  } else if (envCategory === 'green') {
    recommendedServices.push({
      code: 'MPCB-GREEN',
      title: 'Fast-Track Green Category Consent & Intimation',
      department: 'Maharashtra Pollution Control Board (MPCB)',
      authority: 'MPCB Regional Officer',
      turnaroundDays: 5,
      priority: 'PREREQUISITE_STAGE_2'
    });
  }

  // Power recommendation
  if (powerRequired === 'high') {
    recommendedServices.push({
      code: 'MSEDCL-HT',
      title: 'High Tension (HT) Industrial Power Load Sanction',
      department: 'Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL)',
      authority: 'MSEDCL Chief Engineer',
      turnaroundDays: 10,
      priority: 'STAGE_3'
    });
    prerequisites.push('Approved layout plan & transformer site earmarked');
  } else {
    recommendedServices.push({
      code: 'MSEDCL-LT',
      title: 'Low Tension (LT) Commercial/Agri Connection',
      department: 'MSEDCL / Mahavitaran',
      authority: 'MSEDCL Sub-Division',
      turnaroundDays: 4,
      priority: 'STAGE_3'
    });
  }

  // Municipal / Factory Act
  recommendedServices.push({
    code: 'FACTORY-ACT',
    title: 'Directorate of Industrial Safety & Health (DISH) Plan Approval',
    department: 'Labour & DISH Department',
    authority: 'Director of Industrial Safety',
    turnaroundDays: 12,
    priority: 'STAGE_4'
  });

  res.json({
    success: true,
    totalServicesIdentified: recommendedServices.length,
    services: recommendedServices,
    prerequisitesList: prerequisites,
    guidanceNote: 'The Interoperability Layer automatically fetches and satisfies departmental prerequisites (e.g., MPCB auto-verifies Land 7/12 without paper resubmission).'
  });
});

export default router;
