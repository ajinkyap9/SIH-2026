// server/src/rules/statusRules.js

/**
 * Normalizes a department-specific status string into a canonical status vocabulary:
 * PENDING, RESOLVED, WAITING, ACTION_REQUIRED
 * 
 * @param {string} department - 'LAND', 'ELECTRICITY', or 'POLLUTION'
 * @param {string} rawStatus - The raw status from the department API
 * @returns {string} - The canonical status
 */
export function normalizeStatus(department, rawStatus) {
    if (!rawStatus) return 'ACTION_REQUIRED';
    
    const status = rawStatus.toString().toUpperCase();

    switch (department.toUpperCase()) {
        case 'LAND':
            // Land Mutation Status
            if (status.includes('APPROVED')) return 'RESOLVED';
            if (status.includes('PENDING')) return 'WAITING';
            if (status.includes('REJECTED')) return 'ACTION_REQUIRED';
            if (status.includes('UNDER_OBJECTION')) return 'ACTION_REQUIRED';
            break;

        case 'ELECTRICITY':
            // Electricity Application / Connection Status
            if (status.includes('APPROVED') || status.includes('ENERGIZED') || status.includes('SANCTIONED')) return 'RESOLVED';
            if (status.includes('PENDING') || status.includes('UNDER')) return 'WAITING';
            if (status.includes('REJECTED')) return 'ACTION_REQUIRED';
            break;

        case 'POLLUTION':
            // Pollution Consent Status
            if (status.includes('APPROVED')) return 'RESOLVED';
            if (status.includes('PENDING')) return 'WAITING';
            if (status.includes('REJECTED') || status.includes('REVOKED')) return 'ACTION_REQUIRED';
            break;
    }

    return 'WAITING'; // Default fallback
}
