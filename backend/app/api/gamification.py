"""
Gamification API router for TaaskMaaster.

This module contains API endpoints for gamification features.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models.gamification import PointsType
from app.schemas.gamification import (
    AchievementResponse,
    LeaderboardCreate,
    LeaderboardEntryList,
    LeaderboardList,
    LeaderboardResponse,
    PointsList,
    PointsResponse,
    StreakList,
    StreakResponse,
    UserAchievementResponse,
    UserPointsSummary,
)
from app.services.gamification_service import GamificationService

router = APIRouter(prefix="/api/v1/gamification", tags=["gamification"])


# Points
@router.get("/points", response_model=List[PointsResponse])
async def get_all_points(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
):
    """Get all points transactions."""
    GamificationService(db)
    # For now, return empty list - in a real app, you might want to return
    # aggregated points or recent transactions
    return []


@router.post(
    "/points/award",
    response_model=PointsResponse,
    status_code=status.HTTP_201_CREATED,
)
async def award_points(
    user_id: int,
    amount: int,
    points_type: PointsType,
    description: Optional[str] = Query(
        None, description="Transaction description"
    ),
    reference_id: Optional[int] = Query(
        None, description="Reference to related entity"
    ),
    reference_type: Optional[str] = Query(
        None, description="Type of reference entity"
    ),
    db: Session = Depends(get_db_session),
):
    """Award points to a user."""
    gamification_service = GamificationService(db)
    points = gamification_service.award_points(
        user_id=user_id,
        amount=amount,
        points_type=points_type,
        description=description,
        reference_id=reference_id,
        reference_type=reference_type,
    )
    return points


@router.get("/points/summary/{user_id}", response_model=UserPointsSummary)
async def get_user_points_summary(
    user_id: int, db: Session = Depends(get_db_session)
):
    """Get points summary for a user."""
    gamification_service = GamificationService(db)
    summary = gamification_service.get_user_points_summary(user_id)
    return summary


@router.get("/points/history/{user_id}", response_model=PointsList)
async def get_user_points_history(
    user_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
):
    """Get points history for a user."""
    gamification_service = GamificationService(db)
    points, total = gamification_service.get_user_points_history(
        user_id, skip, limit
    )

    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1

    return PointsList(
        points=points, total=total, page=page, size=limit, pages=pages
    )


# Achievements
@router.get("/achievements", response_model=List[AchievementResponse])
async def get_achievements(db: Session = Depends(get_db_session)):
    """Get all available achievements."""
    GamificationService(db)
    # TODO: Add method to get all achievements
    return []


@router.get(
    "/achievements/user/{user_id}",
    response_model=List[UserAchievementResponse],
)
async def get_user_achievements(
    user_id: int, db: Session = Depends(get_db_session)
):
    """Get achievements for a user."""
    gamification_service = GamificationService(db)
    achievements = gamification_service.get_user_achievements(user_id)
    return achievements


@router.post("/achievements/check/{user_id}", status_code=status.HTTP_200_OK)
async def check_and_award_achievements(
    user_id: int, db: Session = Depends(get_db_session)
):
    """Check and award achievements to a user."""
    gamification_service = GamificationService(db)
    newly_awarded = gamification_service.check_and_award_achievements(user_id)

    return {
        "message": f"Awarded {len(newly_awarded)} new achievements",
        "new_achievements": [
            {"id": a.id, "name": a.name} for a in newly_awarded
        ],
    }


# Leaderboards
@router.post(
    "/leaderboards",
    response_model=LeaderboardResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_leaderboard(
    leaderboard_data: LeaderboardCreate, db: Session = Depends(get_db_session)
):
    """Create a new leaderboard."""
    gamification_service = GamificationService(db)
    leaderboard = gamification_service.create_leaderboard(leaderboard_data)
    return leaderboard


@router.get("/leaderboards", response_model=LeaderboardList)
async def get_leaderboards(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
):
    """Get all leaderboards."""
    # TODO: Add method to get leaderboards
    return LeaderboardList(
        leaderboards=[], total=0, page=1, size=limit, pages=0
    )


@router.post(
    "/leaderboards/{leaderboard_id}/update", status_code=status.HTTP_200_OK
)
async def update_leaderboard_scores(
    leaderboard_id: int, db: Session = Depends(get_db_session)
):
    """Update scores for a leaderboard."""
    gamification_service = GamificationService(db)
    updated_count = gamification_service.update_leaderboard_scores(
        leaderboard_id
    )

    return {
        "message": f"Updated {updated_count} leaderboard entries",
        "updated_count": updated_count,
    }


@router.get(
    "/leaderboards/{leaderboard_id}/entries",
    response_model=LeaderboardEntryList,
)
async def get_leaderboard_entries(
    leaderboard_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
):
    """Get leaderboard entries."""
    gamification_service = GamificationService(db)
    entries, total = gamification_service.get_leaderboard_entries(
        leaderboard_id, skip, limit
    )

    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1

    return LeaderboardEntryList(
        entries=entries, total=total, page=page, size=limit, pages=pages
    )


# Streaks
@router.get("/streaks", response_model=List[StreakResponse])
async def get_all_streaks(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
):
    """Get all streaks."""
    GamificationService(db)
    # For now, return empty list - in a real app, you might want to return
    # all user streaks or aggregated data
    return []


@router.post(
    "/streaks/update",
    response_model=StreakResponse,
    status_code=status.HTTP_200_OK,
)
async def update_user_streak(
    user_id: int,
    streak_type: str = Query(..., description="Type of streak"),
    db: Session = Depends(get_db_session),
):
    """Update user streak based on activity."""
    gamification_service = GamificationService(db)
    streak = gamification_service.update_user_streak(user_id, streak_type)

    if not streak:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update streak",
        )

    return streak


@router.get("/streaks/user/{user_id}", response_model=StreakList)
async def get_user_streaks(
    user_id: int,
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=1000, description="Maximum number of records to return"
    ),
    db: Session = Depends(get_db_session),
):
    """Get all streaks for a user."""
    gamification_service = GamificationService(db)
    streaks = gamification_service.get_user_streaks(user_id)

    total = len(streaks)
    pages = (total + limit - 1) // limit
    page = (skip // limit) + 1

    # Apply pagination
    paginated_streaks = streaks[skip : skip + limit]

    return StreakList(
        streaks=paginated_streaks,
        total=total,
        page=page,
        size=limit,
        pages=pages,
    )
