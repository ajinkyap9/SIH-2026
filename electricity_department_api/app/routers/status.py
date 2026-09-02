import time
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.api_key import require_scope
from app.models.electricity import ApiConsumer
from app.schemas.responses import StatusResponse
from app.services.electricity_service import ElectricityService
from app.services.audit_service import AuditService
from app.services.chaos_service import ChaosService
from app.utils.transaction import generate_status_transaction_id

router = APIRouter(prefix="/api/electricity", tags=["Status"])


@router.get(
    "/status/{application_number}",
    response_model=StatusResponse,
    summary="Lightweight Status Polling",
    description="Optimized endpoint for asynchronous polling by external interoperability workflows."
)
async def get_application_status(
    application_number: str,
    request: Request,
    x_correlation_id: Optional[str] = Header(None, alias="X-Correlation-ID"),
    x_bypass_chaos: Optional[bool] = Header(False, alias="X-Bypass-Chaos"),
    consumer: ApiConsumer = Depends(require_scope("/api/electricity/*")),
    db: Session = Depends(get_db),
):
    start_time = time.time()
    transaction_id = generate_status_transaction_id()
    request.state.transaction_id = transaction_id

    # Chaos check
    await ChaosService.maybe_simulate_chaos(
        endpoint_type="status",
        transaction_id=transaction_id,
        bypass=x_bypass_chaos
    )

    app = ElectricityService.get_application_by_number(db, application_number)
    elapsed_ms = (time.time() - start_time) * 1000

    if not app:
        AuditService.log_request(
            db=db,
            transaction_id=transaction_id,
            endpoint=f"/api/electricity/status/{application_number}",
            response_code=404,
            response_time_ms=elapsed_ms,
            outcome="FAILED",
            consumer_id=consumer.consumer_id,
            application_number=application_number,
            failure_type="NOT_FOUND"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "status": "NOT_FOUND",
                "department": "ELECTRICITY_DISTRIBUTION",
                "message": "Electricity application not found",
                "application_number": application_number,
                "transaction_id": transaction_id
            }
        )

    # Determine retryable: True if in an intermediate/pending state, False if terminal (e.g. APPROVED & ENERGIZED or REJECTED)
    is_terminal = (
        app.application_status == "REJECTED" or
        (app.application_status == "APPROVED" and app.connection_status == "ENERGIZED")
    )
    retryable = not is_terminal

    AuditService.log_request(
        db=db,
        transaction_id=transaction_id,
        endpoint=f"/api/electricity/status/{application_number}",
        response_code=200,
        response_time_ms=elapsed_ms,
        outcome="SUCCESS",
        consumer_id=consumer.consumer_id,
        application_number=application_number
    )

    return StatusResponse(
        transaction_id=transaction_id,
        application_number=app.application_number,
        application_status=app.application_status,
        inspection_status=app.inspection_status,
        meter_status=app.meter_status,
        connection_status=app.connection_status,
        last_updated=app.last_updated.isoformat() if app.last_updated else "",
        retryable=retryable
    )
