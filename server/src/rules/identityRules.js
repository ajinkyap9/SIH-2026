// server/src/rules/identityRules.js

/**
 * Deterministically checks if a department record belongs to 
 * the expected applicant organization based on PAN.
 * 
 * @param {Object} canonicalRecord - The department record mapped to canonical model
 * @param {string} requestedPan - The PAN of the organization attempting access
 * @returns {boolean} - true if matched, false otherwise
 */
export function verifyIdentity(canonicalRecord, requestedPan) {
    if (!canonicalRecord || !canonicalRecord.organization_pan || !requestedPan) {
        return false;
    }
    
    // Normalize both for comparison (uppercase, strip spaces)
    const recordPan = canonicalRecord.organization_pan.toUpperCase().replace(/[\s-]/g, '');
    const targetPan = requestedPan.toUpperCase().replace(/[\s-]/g, '');
    
    return recordPan === targetPan;
}
