// server/src/mappings/pollutionMapping.js

/**
 * Deterministic mapping from Pollution Department (MPCB) API raw schema 
 * to the Interoperability Canonical Model.
 */
export const pollutionMapping = {
    industry_pan: "organization_pan",
    industry_name: "organization_name",
    application_no: "application_number",
    application_project_id: "project_id",
    plant_location: "location",
    region: "district",
    industry_type: "industry_type",
    consent_status: "consent_status", // Also mapped to 'status' via status rules
    compliance_status: "compliance_status",
    valid_until: "valid_until",
    air_emission_category: "air_emission_category",
    water_discharge_category: "water_discharge_category",
    hazardous_waste: "hazardous_waste",
    environmental_clearance_required: "environmental_clearance_required"
};
