import logging
from fastapi import APIRouter, HTTPException

from app.intake.models import InterviewMessageRequest
from app.intake.interview.engine import process_message, get_decision
from app.intake.interview.session import get_session_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interview", tags=["RAG Intake & Conversational Interview"])


@router.post(
    "/message",
    summary="Conduct Conversational Intake Interview",
    description="""
    Interactive conversational interview step.
    - Start interview by passing `user_response: null`.
    - Continue by passing user choices.
    - Uses RAG retrieval to explain the regulatory 'why' for each question.
    - When completed, compiles the Project Profile and runs the deterministic Decision Engine.
    """
)
async def interview_message(request: InterviewMessageRequest) -> dict:
    try:
        result = process_message(
            session_id=request.session_id,
            user_response=request.user_response,
        )
        return result
    except Exception as e:
        logger.error(f"Error processing message for session {request.session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error processing interview message: {str(e)}",
        )


@router.get(
    "/{session_id}/decision",
    summary="Retrieve Regulatory Decision & Execution Plan",
    description="""
    Returns the required government services, legal reasoning, and execution wave plan:
    - Required departmental services (LAND, ELECTRICITY, POLLUTION)
    - Justification & legal reasoning
    - Dependency-ordered execution waves (e.g. Wave 1 -> Wave 2)
    """
)
async def interview_decision(session_id: str) -> dict:
    store = get_session_store()
    session = store.get(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found.",
        )

    if session.state.value != "COMPLETE":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Interview for session {session_id} is not complete "
                f"(state: {session.state.value}). Cannot get decision."
            ),
        )

    try:
        decision_result = get_decision(session_id)
        if decision_result is None:
            raise HTTPException(
                status_code=500,
                detail="Decision engine produced no result.",
            )
        return decision_result.model_dump()
    except Exception as e:
        logger.error(f"Error getting decision for session {session_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving decision: {str(e)}",
        )
