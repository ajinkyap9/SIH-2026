// server/src/mappings/electricityMapping.js

/**
 * Deterministic mapping from Electricity Department API raw schema 
 * to the Interoperability Canonical Model.
 */
export const electricityMapping = {
    cust_pan: "organization_pan",
    cust_name: "organization_name",
    appl_no: "application_number",
    load_req: "requested_load_kw",
    load_sanc: "sanctioned_load_kw",
    appl_stat: "status",
    conn_stat: "connection_status",
    conn_type: "connection_type",
    dues_flag: "outstanding_dues",
    insp_stat: "inspection_status",
    meter_stat: "meter_status",
    sec_dep: "security_deposit"
};

/**
 * Lookup table for specific Electricity Industry Category Codes.
 * Used to normalize specific codes into generic ones.
 */
export const electricityCategoryCodeLookup = {
    "IND": "INDUSTRIAL",
    "COM": "COMMERCIAL",
    "AGR": "AGRICULTURAL",
    "RES": "RESIDENTIAL"
};
