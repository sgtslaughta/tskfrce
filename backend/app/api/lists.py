"""
Task Lists API endpoints for TaaskMaaster.

This module provides API endpoints for managing task lists, including
creating, updating, deleting lists, and managing task associations.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.session import get_db_session
from app.models.task import Task, TaskList, TaskListAssociation
from app.models.user import User
from app.schemas.task import (
    TaskListBulkUpdate,
    TaskListCreate,
    TaskListResponse,
    TaskListStats,
    TaskListUpdate,
    TaskListWithTasks,
    TaskListAssociationCreate,
    TaskListAssociationResponse,
)
from app.services.task_service import TaskService

router = APIRouter(prefix="/api/v1/lists", tags=["lists"])


@router.get("/", response_model=List[TaskListResponse])
async def get_task_lists(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get all task lists for the current user.
    
    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        include_archived: Whether to include archived lists
        db: Database session
        current_user: Current user
        
    Returns:
        List of task lists
    """
    query = db.query(TaskList).filter(TaskList.created_by_id == current_user.id)
    
    if not include_archived:
        query = query.filter(TaskList.is_archived == False)
    
    lists = query.offset(skip).limit(limit).all()
    
    # Calculate task counts for each list
    result = []
    for task_list in lists:
        task_count = db.query(TaskListAssociation).filter(
            TaskListAssociation.list_id == task_list.id
        ).count()
        
        completed_task_count = db.query(TaskListAssociation).join(Task).filter(
            TaskListAssociation.list_id == task_list.id,
            Task.status == "done"
        ).count()
        
        list_data = TaskListResponse.model_validate(task_list)
        list_data.task_count = task_count
        list_data.completed_task_count = completed_task_count
        result.append(list_data)
    
    return result


@router.post("/", response_model=TaskListResponse, status_code=status.HTTP_201_CREATED)
async def create_task_list(
    task_list: TaskListCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new task list.
    
    Args:
        task_list: Task list data
        db: Database session
        current_user: Current user
        
    Returns:
        Created task list
    """
    db_task_list = TaskList(
        **task_list.model_dump(),
        created_by_id=current_user.id
    )
    db.add(db_task_list)
    db.commit()
    db.refresh(db_task_list)
    
    return TaskListResponse.model_validate(db_task_list)


@router.get("/{list_id}", response_model=TaskListWithTasks)
async def get_task_list(
    list_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get a specific task list with its tasks.
    
    Args:
        list_id: Task list ID
        db: Database session
        current_user: Current user
        
    Returns:
        Task list with associated tasks
    """
    task_list = db.query(TaskList).filter(
        TaskList.id == list_id,
        TaskList.created_by_id == current_user.id
    ).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task list not found"
        )
    
    # Get tasks with their positions
    tasks_with_positions = db.query(Task, TaskListAssociation.position).join(
        TaskListAssociation
    ).filter(
        TaskListAssociation.list_id == list_id
    ).order_by(TaskListAssociation.position).all()
    
    # Convert to response format
    tasks = []
    for task, position in tasks_with_positions:
        # Convert task to dict and handle relationships properly
        task_data = {
            'id': task.id,
            'title': task.title,
            'description': task.description,
            'status': task.status,
            'priority': task.priority,
            'due_date': task.due_date,
            'completed_at': task.completed_at,
            'estimated_hours': task.estimated_hours,
            'actual_hours': task.actual_hours,
            'points': task.points,
            'reward_type': task.reward_type,
            'reward_value': task.reward_value,
            'reward_description': task.reward_description,
            'is_recurring': task.is_recurring,
            'recurrence_pattern': task.recurrence_pattern,
            'template_id': task.template_id,
            'category_id': task.category_id,
            'created_by_id': task.created_by_id,
            'assigned_to_id': task.assigned_to_id,
            'parent_task_id': task.parent_task_id,
            'created_at': task.created_at,
            'updated_at': task.updated_at,
            # Handle relationships as dictionaries
            'assigned_to': task.assigned_to.__dict__ if task.assigned_to else None,
            'category': task.category.__dict__ if task.category else None,
            'template': task.template.__dict__ if task.template else None,
            'tags': [tag.__dict__ for tag in task.tags] if task.tags else [],
            'subtasks': [],
            'dependencies': [],
            'media_attachments': []
        }
        
        # Remove SQLAlchemy internal state from related objects
        if task_data['assigned_to']:
            task_data['assigned_to'].pop('_sa_instance_state', None)
        if task_data['category']:
            task_data['category'].pop('_sa_instance_state', None)
        if task_data['template']:
            task_data['template'].pop('_sa_instance_state', None)
        for tag in task_data['tags']:
            tag.pop('_sa_instance_state', None)
            
        tasks.append(task_data)
    
    # Create the response object manually to avoid validation issues
    response_data = {
        'id': task_list.id,
        'name': task_list.name,
        'description': task_list.description,
        'color': task_list.color,
        'is_public': task_list.is_public,
        'is_archived': task_list.is_archived,
        'created_by_id': task_list.created_by_id,
        'created_at': task_list.created_at,
        'updated_at': task_list.updated_at,
        'task_count': len(tasks),
        'completed_task_count': len([t for t in tasks if t.get('status') == 'done']),
        'tasks': tasks
    }
    
    return TaskListWithTasks.model_validate(response_data)


@router.put("/{list_id}", response_model=TaskListResponse)
async def update_task_list(
    list_id: int,
    task_list_update: TaskListUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Update a task list.
    
    Args:
        list_id: Task list ID
        task_list_update: Updated task list data
        db: Database session
        current_user: Current user
        
    Returns:
        Updated task list
    """
    task_list = db.query(TaskList).filter(
        TaskList.id == list_id,
        TaskList.created_by_id == current_user.id
    ).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task list not found"
        )
    
    update_data = task_list_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task_list, field, value)
    
    db.commit()
    db.refresh(task_list)
    
    return TaskListResponse.model_validate(task_list)


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_list(
    list_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a task list.
    
    Args:
        list_id: Task list ID
        db: Database session
        current_user: Current user
    """
    task_list = db.query(TaskList).filter(
        TaskList.id == list_id,
        TaskList.created_by_id == current_user.id
    ).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task list not found"
        )
    
    # Delete all associations first
    db.query(TaskListAssociation).filter(
        TaskListAssociation.list_id == list_id
    ).delete()
    
    # Delete the list
    db.delete(task_list)
    db.commit()


@router.post("/{list_id}/tasks", response_model=TaskListAssociationResponse)
async def add_task_to_list(
    list_id: int,
    association: TaskListAssociationCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Add a task to a list.
    
    Args:
        list_id: Task list ID
        association: Task association data
        db: Database session
        current_user: Current user
        
    Returns:
        Created task list association
    """
    # Verify list exists and user owns it
    task_list = db.query(TaskList).filter(
        TaskList.id == list_id,
        TaskList.created_by_id == current_user.id
    ).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task list not found"
        )
    
    # Verify task exists
    task = db.query(Task).filter(Task.id == association.task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # Check if task is already in list
    existing_association = db.query(TaskListAssociation).filter(
        TaskListAssociation.list_id == list_id,
        TaskListAssociation.task_id == association.task_id
    ).first()
    
    if existing_association:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task is already in this list"
        )
    
    # Determine position
    if association.position is None:
        max_position = db.query(TaskListAssociation).filter(
            TaskListAssociation.list_id == list_id
        ).count()
        position = max_position
    else:
        position = association.position
    
    # Create association
    db_association = TaskListAssociation(
        task_id=association.task_id,
        list_id=list_id,
        position=position
    )
    db.add(db_association)
    db.commit()
    db.refresh(db_association)
    
    return TaskListAssociationResponse.model_validate(db_association)


@router.delete("/{list_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_task_from_list(
    list_id: int,
    task_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Remove a task from a list.
    
    Args:
        list_id: Task list ID
        task_id: Task ID
        db: Database session
        current_user: Current user
    """
    # Verify list exists and user owns it
    task_list = db.query(TaskList).filter(
        TaskList.id == list_id,
        TaskList.created_by_id == current_user.id
    ).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task list not found"
        )
    
    # Find and delete association
    association = db.query(TaskListAssociation).filter(
        TaskListAssociation.list_id == list_id,
        TaskListAssociation.task_id == task_id
    ).first()
    
    if not association:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task is not in this list"
        )
    
    db.delete(association)
    db.commit()


@router.put("/{list_id}/tasks/reorder", response_model=List[TaskListAssociationResponse])
async def reorder_tasks_in_list(
    list_id: int,
    bulk_update: TaskListBulkUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Reorder tasks within a list.
    
    Args:
        list_id: Task list ID
        bulk_update: New task positions
        db: Database session
        current_user: Current user
        
    Returns:
        Updated task associations
    """
    # Verify list exists and user owns it
    task_list = db.query(TaskList).filter(
        TaskList.id == list_id,
        TaskList.created_by_id == current_user.id
    ).first()
    
    if not task_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task list not found"
        )
    
    # Update positions
    for task_position in bulk_update.task_positions:
        task_id = task_position.get("task_id")
        position = task_position.get("position")
        
        if task_id is None or position is None:
            continue
        
        association = db.query(TaskListAssociation).filter(
            TaskListAssociation.list_id == list_id,
            TaskListAssociation.task_id == task_id
        ).first()
        
        if association:
            association.position = position
    
    db.commit()
    
    # Return updated associations
    associations = db.query(TaskListAssociation).filter(
        TaskListAssociation.list_id == list_id
    ).order_by(TaskListAssociation.position).all()
    
    return [TaskListAssociationResponse.model_validate(assoc) for assoc in associations]


@router.get("/stats/overview", response_model=TaskListStats)
async def get_list_stats(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    Get task list statistics for the current user.
    
    Args:
        db: Database session
        current_user: Current user
        
    Returns:
        Task list statistics
    """
    # Get total lists
    total_lists = db.query(TaskList).filter(
        TaskList.created_by_id == current_user.id,
        TaskList.is_archived == False
    ).count()
    
    # Get total tasks in lists
    total_tasks = db.query(TaskListAssociation).join(TaskList).filter(
        TaskList.created_by_id == current_user.id,
        TaskList.is_archived == False
    ).count()
    
    # Get completed tasks
    completed_tasks = db.query(TaskListAssociation).join(TaskList).join(Task).filter(
        TaskList.created_by_id == current_user.id,
        TaskList.is_archived == False,
        Task.status == "done"
    ).count()
    
    # Calculate completion rate
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    # Get most active list
    most_active_list = db.query(TaskList.name).join(TaskListAssociation).filter(
        TaskList.created_by_id == current_user.id,
        TaskList.is_archived == False
    ).group_by(TaskList.id, TaskList.name).order_by(
        func.count(TaskListAssociation.id).desc()
    ).first()
    
    return TaskListStats(
        total_lists=total_lists,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        completion_rate=completion_rate,
        most_active_list=most_active_list[0] if most_active_list else None,
        recent_activity=[]
    )
