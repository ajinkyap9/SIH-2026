// server/src/rules/dependencyRules.js

/**
 * Rules for evaluating cross-department dependencies.
 * For example, evaluating if a Pollution Consent application has its Land prerequisites met.
 */

/**
 * Evaluates the Land Department dependency for a given project/organization.
 * 
 * @param {Object} canonicalLand - The land record mapped to the canonical model
 * @param {string} organizationPan - The PAN of the organization requesting the evaluation
 * @returns {Object} - { resolved: boolean, status: string, reason: string }
 */
export function evaluateLandDependency(canonicalLand, organizationPan) {
    if (!canonicalLand) {
        return {
            resolved: false,
            status: 'FAILED',
            reason: 'Land record could not be retrieved or mapped.'
        };
    }

    // 1. Identity Check
    if (canonicalLand.ownership_status === 'INVALID') {
        return {
            resolved: false,
            status: 'FAILED',
            reason: 'Identity mismatch: Evaluated organization PAN does not match Land Ownership PAN.'
        };
    }

    // 2. Status Check
    if (canonicalLand.status === 'WAITING') {
        return {
            resolved: false,
            status: 'WAITING',
            reason: 'Land Mutation (7/12 Jamabandi) is PENDING at Tahsildar / Revenue Department.'
        };
    }
    
    if (canonicalLand.status === 'ACTION_REQUIRED') {
        return {
            resolved: false,
            status: 'ACTION_REQUIRED',
            reason: 'Land Record is UNDER OBJECTION or REJECTED. Action required by applicant.'
        };
    }

    // 3. Business Rules Check
    if (canonicalLand.encumbrance === true) {
        return {
            resolved: false,
            status: 'ACTION_REQUIRED',
            reason: 'Active bank encumbrance flag present on land record. NOC required.'
        };
    }

    if (canonicalLand.court_case === true) {
        return {
            resolved: false,
            status: 'BLOCKED',
            reason: 'Land record has an active civil court dispute flag.'
        };
    }

    // If we passed everything
    return {
        resolved: true,
        status: 'RESOLVED',
        reason: 'Land Ownership, Mutation, and Legal Status verified.'
    };
}
