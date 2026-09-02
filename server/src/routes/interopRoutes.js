import express from 'express';
import { db } from '../db/seedData.js';
import { mapToCanonical } from '../mapper/ruleBasedMapper.js';
import { landMapping } from '../mappings/landMapping.js';
import { electricityMapping } from '../mappings/electricityMapping.js';
import { pollutionMapping } from '../mappings/pollutionMapping.js';
import { evaluateLandDependency } from '../rules/dependencyRules.js';

const router = express.Router();

/**
 * POST /api/interop/verify-dependency
 * Core deterministic verification and dependency engine.
 */
router.post('/verify-dependency', (req, res) => {
    const { department, rawData, organizationPan } = req.body;

    if (!department || !rawData || !organizationPan) {
        return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    let mappingDict;
    if (department === 'LAND') mappingDict = landMapping;
    else if (department === 'ELECTRICITY') mappingDict = electricityMapping;
    else if (department === 'POLLUTION') mappingDict = pollutionMapping;
    else return res.status(400).json({ success: false, message: 'Invalid department' });

    // 1. Map to Canonical Model
    const canonicalRecord = mapToCanonical(rawData, mappingDict, department, organizationPan);

    // 2. Evaluate Dependencies (currently only implemented Land evaluation logic as a demo)
    let dependencyResult = {
        resolved: false,
        status: 'WAITING',
        reason: 'Pending evaluation'
    };

    if (department === 'LAND') {
        dependencyResult = evaluateLandDependency(canonicalRecord, organizationPan);
    } else {
        // Generic evaluation for others based purely on identity and normalized status
        if (canonicalRecord.ownership_status === 'INVALID') {
            dependencyResult = { resolved: false, status: 'FAILED', reason: 'Identity (PAN) mismatch' };
        } else if (canonicalRecord.status === 'WAITING') {
            dependencyResult = { resolved: false, status: 'WAITING', reason: 'Department process pending' };
        } else if (canonicalRecord.status === 'ACTION_REQUIRED') {
            dependencyResult = { resolved: false, status: 'ACTION_REQUIRED', reason: 'Action required in department' };
        } else {
            dependencyResult = { resolved: true, status: 'RESOLVED', reason: 'Verified successfully' };
        }
    }

    // 3. Log Audit Trail
    db.auditLogs.push({
        id: `AUD-INTEROP-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: 'DEPENDENCY_EVALUATED',
        department,
        status: dependencyResult.status,
        pan: organizationPan
    });

    res.json({
        success: true,
        canonicalModel: canonicalRecord,
        dependencyStatus: dependencyResult.status,
        dependencyReason: dependencyResult.reason
    });
});

/**
 * POST /api/interop/evaluate-project
 * Kept for full backward-compatibility with the MAITRI citizen dashboard on index.html.
 * Uses the new ruleBasedMapper internally.
 */
router.post('/evaluate-project', (req, res) => {
    const { applicantPan, surveyNumber } = req.body;
    const surveyToUse = surveyNumber || '101';
    const panToUse = applicantPan || 'ABCDE1234F';

    const rawLand = db.landRecords[surveyToUse] || db.landRecords['101'];
    if (!rawLand) {
        return res.status(404).json({ success: false, message: 'Land record not found' });
    }

    // Map through the new Rule-Based Canonical Mapper
    const canonicalLand = mapToCanonical(rawLand, landMapping, 'LAND', panToUse);
    const landDep = evaluateLandDependency(canonicalLand, panToUse);

    const workflow = {
        applicationId: `G2B-MH-2026-${surveyToUse}`,
        surveyNumber: surveyToUse,
        lastEvaluatedAt: new Date().toISOString(),
        overallStatus: landDep.resolved ? 'READY_FOR_SANCTION' : 'DEPENDENCY_WAITING',
        dependencies: [
            {
                id: 'DEP-LAND-01',
                title: 'Land Ownership & 7/12 Jamabandi Verification',
                department: 'Land Revenue & Settlement Department',
                status: landDep.status,
                reason: landDep.reason,
                lastChecked: new Date().toISOString(),
                details: canonicalLand
            },
            {
                id: 'DEP-MPCB-02',
                title: 'MPCB Consent to Establish (CTE)',
                department: 'Maharashtra Pollution Control Board',
                status: landDep.resolved ? 'IN_PROGRESS' : 'WAITING_FOR_PREREQUISITE',
                reason: landDep.resolved ? 'Prerequisite Land Title Verified.' : 'Blocked: Waiting for Land Verification = RESOLVED',
                lastChecked: new Date().toISOString()
            },
            {
                id: 'DEP-ELEC-03',
                title: 'High-Tension Industrial Power Sanction',
                department: 'MSEDCL / Electricity Distribution',
                status: landDep.resolved ? 'IN_PROGRESS' : 'WAITING_FOR_PREREQUISITE',
                reason: landDep.resolved ? 'Prerequisite Land verified.' : 'Blocked: Waiting for Land Verification = RESOLVED',
                lastChecked: new Date().toISOString()
            }
        ]
    };

    db.auditLogs.push({
        id: `AUD-EVAL-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: 'PROJECT_EVALUATION',
        surveyNumber: surveyToUse,
        status: landDep.status
    });

    res.json({
        success: true,
        workflow,
        rawLegacyPayload: rawLand,
        canonicalModel: canonicalLand
    });
});

/**
 * POST /api/interop/submit-application (Secondary Feature)
 * Demonstrates the start of a multi-department workflow.
 */
router.post('/submit-application', (req, res) => {
    const { organizationName, organizationPan, projectType, surveyNumber, requestedLoadKw, location } = req.body;

    if (!organizationPan) {
        return res.status(400).json({ success: false, message: 'Organization PAN is required' });
    }

    const applicationId = `MAITRI-APP-${Date.now().toString().slice(-6)}`;
    
    db.auditLogs.push({
        id: `AUD-APP-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: 'APPLICATION_SUBMITTED',
        applicationId,
        pan: organizationPan
    });

    res.json({
        success: true,
        applicationId,
        organizationName: organizationName || 'Applicant Organization',
        organizationPan: organizationPan.toUpperCase(),
        projectType: projectType || 'INDUSTRIAL',
        surveyNumber: surveyNumber || 'N/A',
        requestedLoadKw: requestedLoadKw || 'N/A',
        location: location || 'Maharashtra',
        status: 'WORKFLOW_INITIATED',
        message: 'Common Application Form (CAF) registered. Parallel departmental clearances initiated.',
        submittedAt: new Date().toISOString(),
        pendingVerifications: [
            { department: 'LAND', type: 'Land Title & Mutation Check (Revenue Dept)', required: true },
            { department: 'POLLUTION', type: 'MPCB Consent to Establish (CTE / CTO)', required: projectType === 'INDUSTRIAL' },
            { department: 'ELECTRICITY', type: 'MSEDCL Load Feasibility & Substation Sanction', required: true }
        ]
    });
});

// GET /api/interop/audit-logs
router.get('/audit-logs', (req, res) => {
    res.json({
        success: true,
        totalLogs: db.auditLogs.length,
        logs: db.auditLogs.slice().reverse()
    });
});

export default router;
