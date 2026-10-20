"""
Workflow schemas for TaaskMaaster API.

This module contains Pydantic models for workflow-related API operations.
"""

from pydantic import BaseModel, Field

from app.models.task import TaskStatus


class WorkflowTransitionRequest(BaseModel):
    """Schema for task status transition request."""

    task_id: int = Field(..., description="Task ID")
    new_status: TaskStatus = Field(..., description="New status to transition to")
    comment: str | None = Field(
        None, max_length=1000, description="Optional comment for the transition"
    )
    force: bool = Field(default=False, description="Force transition (admin only)")


class WorkflowApprovalRequest(BaseModel):
    """Schema for task approval request."""

    task_id: int = Field(..., description="Task ID")
    comment: str | None = Field(None, max_length=1000, description="Optional approval comment")


class WorkflowRejectionRequest(BaseModel):
    """Schema for task rejection request."""

    task_id: int = Field(..., description="Task ID")
    reason: str = Field(..., min_length=1, max_length=1000, description="Reason for rejection")


class WorkflowTransitionResponse(BaseModel):
    """Schema for workflow transition response."""

    success: bool
    message: str
    task_id: int
    previous_status: str
    new_status: str
    transitioned_by: int
    comment: str | None = None


class ValidTransitionsResponse(BaseModel):
    """Schema for valid transitions response."""

    task_id: int
    current_status: TaskStatus
    valid_transitions: list[TaskStatus]
    user_id: int
