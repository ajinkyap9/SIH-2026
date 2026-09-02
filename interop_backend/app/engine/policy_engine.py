from typing import Dict, Any, List, Tuple
from app.schemas.canonical import CanonicalProjectModel


class PolicyEngine:
    """Evaluates cross-department enterprise facts and prerequisite dependencies."""

    @staticmethod
    def verify_pan_identity(
        project_pan: str,
        land_pan: str | None,
        elec_pan: str | None,
        poll_pan: str | None,
    ) -> Tuple[bool, List[str]]:
        """Strict deterministic PAN identity verification across all queried departments."""
        norm_proj = project_pan.strip().upper()
        mismatches = []

        if land_pan and land_pan.strip().upper() != norm_proj:
            mismatches.append(f"Land Record PAN ({land_pan}) does not match applicant PAN ({norm_proj})")
        if elec_pan and elec_pan.strip().upper() != norm_proj:
            mismatches.append(f"Electricity Application PAN ({elec_pan}) does not match applicant PAN ({norm_proj})")
        if poll_pan and poll_pan.strip().upper() != norm_proj:
            mismatches.append(f"Pollution Application PAN ({poll_pan}) does not match applicant PAN ({norm_proj})")

        return len(mismatches) == 0, mismatches

    @staticmethod
    def evaluate_overall_clearance(
        canonical: CanonicalProjectModel,
        pan_verified: bool,
    ) -> Tuple[str, str, Dict[str, Any]]:
        """Determines the overall plant establishment clearance status and actionable next steps.
        
        Returns:
            (overall_status, recommended_next_action, detailed_reasons)
        """
        if not pan_verified:
            return (
                "FAILED",
                "Resolve entity PAN identity mismatch between company credentials and departmental records.",
                {"reason": "PAN_MISMATCH"}
            )

        details = {}
        # 1. Land Check
        land_ok = False
        if canonical.land_details:
            mut_ok = canonical.land_details.mutation_status == "APPROVED"
            own_ok = canonical.land_details.ownership_status == "VALID"
            no_enc = not canonical.land_details.encumbrance
            no_court = not canonical.land_details.court_case
            land_ok = mut_ok and own_ok and no_enc and no_court
            details["land"] = {
                "passed": land_ok,
                "mutation": canonical.land_details.mutation_status,
                "ownership": canonical.land_details.ownership_status,
                "encumbrance": canonical.land_details.encumbrance,
                "court_case": canonical.land_details.court_case,
            }
        else:
            details["land"] = {"passed": False, "reason": "No land records provided"}

        # 2. Electricity Check
        elec_ok = False
        if canonical.electricity_details:
            app_ok = canonical.electricity_details.application_status == "APPROVED"
            conn_ok = canonical.electricity_details.connection_status in ["READY_FOR_ENERGIZATION", "ENERGIZED"]
            no_dues = not canonical.electricity_details.outstanding_dues
            elec_ok = app_ok and conn_ok and no_dues
            details["electricity"] = {
                "passed": elec_ok,
                "application_status": canonical.electricity_details.application_status,
                "connection_status": canonical.electricity_details.connection_status,
                "outstanding_dues": canonical.electricity_details.outstanding_dues,
            }
        else:
            details["electricity"] = {"passed": False, "reason": "No electricity records provided"}

        # 3. Pollution Check
        poll_ok = False
        if canonical.pollution_details:
            consent_ok = canonical.pollution_details.consent_status == "APPROVED"
            comp_ok = canonical.pollution_details.compliance_status == "COMPLIANT"
            poll_ok = consent_ok and comp_ok
            details["pollution"] = {
                "passed": poll_ok,
                "consent_status": canonical.pollution_details.consent_status,
                "compliance_status": canonical.pollution_details.compliance_status,
            }
        else:
            details["pollution"] = {"passed": False, "reason": "No pollution records provided"}

        # Overall Status
        if land_ok and elec_ok and poll_ok:
            return (
                "RESOLVED",
                "All departmental prerequisites are satisfied. Plant establishment clearance approved.",
                details
            )

        # Check for pending / waiting states
        is_pending = (
            (canonical.land_details and canonical.land_details.mutation_status == "PENDING") or
            (canonical.electricity_details and canonical.electricity_details.application_status in ["PENDING", "UNDER_INSPECTION"]) or
            (canonical.pollution_details and canonical.pollution_details.consent_status in ["PENDING", "UNDER_REVIEW"])
        )

        if is_pending:
            return (
                "WAITING",
                "Prerequisites in progress. Continue periodic status polling until departmental approvals complete.",
                details
            )

        # Otherwise action required (rejections, dues, encumbrances)
        actions = []
        if canonical.land_details and canonical.land_details.encumbrance:
            actions.append("Clear land encumbrances")
        if canonical.electricity_details and canonical.electricity_details.outstanding_dues:
            actions.append("Clear outstanding electricity dues")
        if canonical.pollution_details and canonical.pollution_details.compliance_status != "COMPLIANT":
            actions.append("Resolve environmental non-compliance violations")

        next_action_str = "; ".join(actions) if actions else "Rectify rejected prerequisites with concerned departments."
        return ("ACTION_REQUIRED", next_action_str, details)
