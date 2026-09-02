// server/src/mapper/ruleBasedMapper.js
import { createCanonicalRecord } from '../canonical/canonicalModel.js';
import { verifyIdentity } from '../rules/identityRules.js';
import { normalizeStatus } from '../rules/statusRules.js';
import { electricityCategoryCodeLookup } from '../mappings/electricityMapping.js';

/**
 * The core Deterministic Mapping Engine.
 * 
 * @param {Object} rawData - The raw JSON record from a department API
 * @param {Object} mappingDict - The specific dictionary (e.g., landMapping)
 * @param {string} departmentName - 'LAND', 'ELECTRICITY', 'POLLUTION'
 * @param {string} requestedPan - The PAN of the organization initiating the workflow
 * @returns {Object} - The fully constructed and evaluated canonical record
 */
export function mapToCanonical(rawData, mappingDict, departmentName, requestedPan) {
    if (!rawData) return null;

    const canonical = createCanonicalRecord();

    // 1. Apply Deterministic Mapping Rules
    for (const [rawKey, canonicalKey] of Object.entries(mappingDict)) {
        if (rawData[rawKey] !== undefined) {
            // Special rules for boolean normalization
            if (typeof canonical[canonicalKey] === 'boolean') {
                canonical[canonicalKey] = Boolean(rawData[rawKey]);
            } else {
                canonical[canonicalKey] = rawData[rawKey];
            }
        }
    }

    // 2. Apply Custom Field Logic (Concatenation, Lookups)
    
    // Land-specific custom mappings
    if (departmentName === 'LAND') {
        if (rawData.taluka && rawData.village) {
            canonical.location = `${rawData.village}, ${rawData.taluka}`;
        }
    }

    // Electricity-specific custom mappings
    if (departmentName === 'ELECTRICITY') {
        if (rawData.cat_code) {
            canonical.industry_type = electricityCategoryCodeLookup[rawData.cat_code] || rawData.cat_code;
        }
    }

    // 3. Apply Status Normalization Rules
    let rawStatus = null;
    if (departmentName === 'LAND') rawStatus = canonical.mutation_status;
    else if (departmentName === 'ELECTRICITY') rawStatus = canonical.status;
    else if (departmentName === 'POLLUTION') rawStatus = canonical.consent_status;

    canonical.status = normalizeStatus(departmentName, rawStatus);

    // 4. Apply Identity Rules
    if (requestedPan) {
        const isMatch = verifyIdentity(canonical, requestedPan);
        canonical.ownership_status = isMatch ? 'VALID' : 'INVALID';
    } else {
        canonical.ownership_status = 'NOT_EVALUATED';
    }

    return canonical;
}
