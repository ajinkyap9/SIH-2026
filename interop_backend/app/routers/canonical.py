from fastapi import APIRouter, HTTPException, status
from app.schemas.canonical import TransformRequest, CanonicalProjectModel
from app.engine.mapper import RuleBasedMapper

router = APIRouter(prefix="/api/canonical", tags=["Canonical Data Transformation"])


@router.post(
    "/transform",
    response_model=CanonicalProjectModel,
    summary="Transform Raw Department Payload to Canonical Model",
    description="Test deterministic schema mapping on arbitrary departmental raw payloads."
)
def transform_payload(body: TransformRequest):
    dept = body.department.upper()
    if dept == "LAND":
        return RuleBasedMapper.transform_land(body.raw_payload, body.requested_pan)
    elif dept == "ELECTRICITY":
        return RuleBasedMapper.transform_electricity(body.raw_payload, body.requested_pan)
    elif dept == "POLLUTION":
        return RuleBasedMapper.transform_pollution(body.raw_payload, body.requested_pan)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"status": "ERROR", "message": f"Unsupported department '{body.department}'. Allowed: LAND, ELECTRICITY, POLLUTION"}
        )
