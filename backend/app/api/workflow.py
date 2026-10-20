"""
Workflow API endpoints for TaaskMaaster.

This module contains FastAPI routes for workflow-related operations.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.core.logging import get_logger
from app.models.user import User
from app.schemas.comment import TaskStatusHistoryListResponse
from app.schemas.workflow import (
    ValidTransitionsResponse,
    WorkflowApprovalRequest,
    WorkflowRejectionRequest,
    WorkflowTransitionRequest,
    WorkflowTransitionResponse,
)
from app.services.workflow_service import WorkflowService

logger = get_logger(__name__)

router = APIRouter()


@router.post("/transition", response_model=WorkflowTransitionResponse)
async def transition_task_status(
    transition_request: WorkflowTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Transition a task to a new status.

    **Request Body:**
    ```json
    {
      "task_id": 456,
      "new_status": "in_progress",
      "comment": "Starting work on this task",
      "force": false
    }
    ```
    """
    user_id = current_user.id

    try:
        workflow_service = WorkflowService(db)

        # Get previous status for response
        from app.models.task import Task

        task_before = db.query(Task).filter(Task.id == transition_request.task_id).first()
        if not task_before:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {transition_request.task_id} not found",
            )

        previous_status = task_before.status

        # Perform transition
        updated_task = workflow_service.transition_task_status(
            task_id=transition_request.task_id,
            new_status=transition_request.new_status,
            user_id=user_id,
            comment=transition_request.comment,
            force=transition_request.force,
        )

        logger.info(
            f"Transitioned task {transition_request.task_id} from {previous_status} "
            f"to {transition_request.new_status} by user {user_id}"
        )

        return WorkflowTransitionResponse(
            success=True,
            message=f"Task transitioned from {previous_status.value} to {transition_request.new_status.value}",
            task_id=transition_request.task_id,
            previous_status=previous_status.value,
            new_status=transition_request.new_status.value,
            transitioned_by=user_id,
            comment=transition_request.comment,
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        logger.warning(f"Failed to transition task status: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error transitioning task status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/approve", response_model=WorkflowTransitionResponse)
async def approve_task(
    approval_request: WorkflowApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Approve a task that's submitted for approval.

    **Request Body:**
    ```json
    {
      "task_id": 456,
      "comment": "Great work! Task approved."
    }
    ```
    """
    user_id = current_user.id

    try:
        workflow_service = WorkflowService(db)

        # Get task info for response
        from app.models.task import Task, TaskStatus

        task_before = db.query(Task).filter(Task.id == approval_request.task_id).first()
        if not task_before:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {approval_request.task_id} not found",
            )

        previous_status = task_before.status

        # Approve task
        updated_task = workflow_service.approve_task(
            task_id=approval_request.task_id,
            approver_id=user_id,
            comment=approval_request.comment,
        )

        logger.info(f"Approved task {approval_request.task_id} by user {user_id}")

        return WorkflowTransitionResponse(
            success=True,
            message="Task approved successfully",
            task_id=approval_request.task_id,
            previous_status=previous_status.value,
            new_status=TaskStatus.DONE.value,
            transitioned_by=user_id,
            comment=approval_request.comment,
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        logger.warning(f"Failed to approve task: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error approving task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.post("/reject", response_model=WorkflowTransitionResponse)
async def reject_task(
    rejection_request: WorkflowRejectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Reject a task that's submitted for approval.

    **Request Body:**
    ```json
    {
      "task_id": 456,
      "reason": "Needs more testing before completion"
    }
    ```
    """
    user_id = current_user.id

    try:
        workflow_service = WorkflowService(db)

        # Get task info for response
        from app.models.task import Task, TaskStatus

        task_before = db.query(Task).filter(Task.id == rejection_request.task_id).first()
        if not task_before:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {rejection_request.task_id} not found",
            )

        previous_status = task_before.status

        # Reject task
        updated_task = workflow_service.reject_task(
            task_id=rejection_request.task_id,
            rejector_id=user_id,
            reason=rejection_request.reason,
        )

        logger.info(f"Rejected task {rejection_request.task_id} by user {user_id}")

        return WorkflowTransitionResponse(
            success=True,
            message="Task rejected and returned to in progress",
            task_id=rejection_request.task_id,
            previous_status=previous_status.value,
            new_status=TaskStatus.IN_PROGRESS.value,
            transitioned_by=user_id,
            comment=f"Task rejected: {rejection_request.reason}",
        )

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        logger.warning(f"Failed to reject task: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error rejecting task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/transitions/{task_id}", response_model=ValidTransitionsResponse)
async def get_valid_transitions(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get valid status transitions for a task based on current status and user permissions.

    """
    user_id = current_user.id

    try:
        workflow_service = WorkflowService(db)

        # Get task current status
        from app.models.task import Task

        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Task {task_id} not found"
            )

        # Get valid transitions
        valid_transitions = workflow_service.get_valid_transitions(task_id, user_id)

        return ValidTransitionsResponse(
            task_id=task_id,
            current_status=task.status,
            valid_transitions=valid_transitions,
            user_id=user_id,
        )

    except Exception as e:
        logger.error(f"Unexpected error getting valid transitions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )


@router.get("/history/{task_id}", response_model=TaskStatusHistoryListResponse)
async def get_task_status_history(
    task_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get status change history for a task.

    **Query Parameters:**
    - skip: Number of records to skip (pagination)
    - limit: Maximum number of records to return
    """
    user_id = current_user.id

    try:
        workflow_service = WorkflowService(db)
        history, total = workflow_service.get_task_status_history(
            task_id=task_id,
            user_id=user_id,
            skip=skip,
            limit=limit,
        )

        return TaskStatusHistoryListResponse(history=history, total=total, skip=skip, limit=limit)

    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except ValueError as e:
        logger.warning(f"Failed to get task status history: {e}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting task status history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error"
        )
