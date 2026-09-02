// server/src/mappings/landMapping.js

/**
 * Deterministic mapping from Land Department API raw schema 
 * to the Interoperability Canonical Model.
 */
export const landMapping = {
    gtn: "survey_number",
    malak_name: "organization_name",
    malak_pan: "organization_pan",
    kshetra: "area_hectares",
    kshetra_unit: "area_unit",
    jamabandi: "mutation_status",
    jamin_prakar: "land_type",
    bandhak: "encumbrance",
    court_case: "court_case",
    district: "district"
};

// Note: `taluka` and `village` are concatenated to `location` in the ruleBasedMapper.
