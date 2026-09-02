// server/src/canonical/canonicalModel.js

/**
 * The Canonical Model represents the unified, standard vocabulary 
 * understood by the Interoperability Engine.
 * 
 * All departmental records are mapped into this shape before 
 * any cross-departmental rules (Identity, Status, Dependency) are evaluated.
 */
export const CanonicalModelSchema = {
    // Identity & Core Tracking
    organization_pan: "",
    organization_name: "",
    project_id: "",
    application_number: "",
    
    // Location Details
    district: "",
    location: "",
    
    // Status (Normalized)
    status: "", // PENDING, RESOLVED, WAITING, ACTION_REQUIRED
    
    // Land-Specific
    survey_number: "",
    mutation_status: "",
    land_type: "",
    ownership_status: "", // Computed via identity matching
    encumbrance: false,
    court_case: false,
    area_hectares: 0,
    area_unit: "",
    
    // Electricity-Specific
    requested_load_kw: 0,
    sanctioned_load_kw: 0,
    connection_status: "",
    industry_type: "",
    connection_type: "",
    outstanding_dues: false,
    inspection_status: "",
    meter_status: "",
    security_deposit: 0,
    
    // Pollution-Specific
    consent_status: "",
    compliance_status: "",
    valid_until: "",
    air_emission_category: "",
    water_discharge_category: "",
    hazardous_waste: false,
    environmental_clearance_required: false
};

/**
 * Helper to create a fresh canonical instance with null/default values
 */
export function createCanonicalRecord() {
    return { ...CanonicalModelSchema };
}
