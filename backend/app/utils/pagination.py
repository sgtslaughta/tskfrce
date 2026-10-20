"""
Enhanced pagination and filtering utilities for TaaskMaaster.

This module provides comprehensive pagination, sorting, and filtering
capabilities for API responses.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Type, Union
from enum import Enum
from dataclasses import dataclass

from sqlalchemy import asc, desc, func, and_, or_
from sqlalchemy.orm import Query, Session
from sqlalchemy.sql import ClauseElement
from fastapi import Query as FastAPIQuery

from app.core.logging import get_logger

logger = get_logger(__name__)


class SortOrder(str, Enum):
    """Sort order options."""
    
    ASC = "asc"
    DESC = "desc"


class FilterOperator(str, Enum):
    """Filter operators for different data types."""
    
    EQUALS = "eq"
    NOT_EQUALS = "ne"
    GREATER_THAN = "gt"
    GREATER_THAN_OR_EQUAL = "gte"
    LESS_THAN = "lt"
    LESS_THAN_OR_EQUAL = "lte"
    CONTAINS = "contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IN = "in"
    NOT_IN = "not_in"
    IS_NULL = "is_null"
    IS_NOT_NULL = "is_not_null"
    BETWEEN = "between"


@dataclass
class FilterCriteria:
    """Filter criteria for database queries."""
    
    field: str
    operator: FilterOperator
    value: Any
    value2: Optional[Any] = None  # For BETWEEN operator


@dataclass
class SortCriteria:
    """Sort criteria for database queries."""
    
    field: str
    order: SortOrder = SortOrder.ASC


@dataclass
class PaginationParams:
    """Pagination parameters."""
    
    skip: int = 0
    limit: int = 50
    max_limit: int = 1000


@dataclass
class PaginationResult:
    """Pagination result with metadata."""
    
    items: List[Any]
    total: int
    skip: int
    limit: int
    has_next: bool
    has_previous: bool
    total_pages: int
    current_page: int


class QueryOptimizer:
    """
    Advanced query optimizer with pagination, filtering, and sorting.
    
    Features:
    - Dynamic filtering with multiple operators
    - Multi-column sorting
    - Cursor-based pagination for large datasets
    - Query performance optimization
    - Permission-aware filtering
    """

    def __init__(self, db: Session):
        """Initialize query optimizer."""
        self.db = db

    def apply_filters(
        self,
        query: Query,
        model: Type,
        filters: List[FilterCriteria]
    ) -> Query:
        """
        Apply filters to a SQLAlchemy query.
        
        Args:
            query: SQLAlchemy query object
            model: SQLAlchemy model class
            filters: List of filter criteria
            
        Returns:
            Filtered query object
        """
        for filter_criteria in filters:
            try:
                column = getattr(model, filter_criteria.field)
                condition = self._build_filter_condition(
                    column, filter_criteria.operator, filter_criteria.value, filter_criteria.value2
                )
                if condition is not None:
                    query = query.filter(condition)
            except AttributeError:
                logger.warning(f"Invalid filter field: {filter_criteria.field} for model {model.__name__}")
            except Exception as e:
                logger.error(f"Error applying filter: {e}")
        
        return query

    def _build_filter_condition(
        self,
        column,
        operator: FilterOperator,
        value: Any,
        value2: Optional[Any] = None
    ) -> Optional[ClauseElement]:
        """Build filter condition based on operator."""
        try:
            if operator == FilterOperator.EQUALS:
                return column == value
            elif operator == FilterOperator.NOT_EQUALS:
                return column != value
            elif operator == FilterOperator.GREATER_THAN:
                return column > value
            elif operator == FilterOperator.GREATER_THAN_OR_EQUAL:
                return column >= value
            elif operator == FilterOperator.LESS_THAN:
                return column < value
            elif operator == FilterOperator.LESS_THAN_OR_EQUAL:
                return column <= value
            elif operator == FilterOperator.CONTAINS:
                return column.ilike(f"%{value}%")
            elif operator == FilterOperator.STARTS_WITH:
                return column.ilike(f"{value}%")
            elif operator == FilterOperator.ENDS_WITH:
                return column.ilike(f"%{value}")
            elif operator == FilterOperator.IN:
                if isinstance(value, (list, tuple)):
                    return column.in_(value)
                else:
                    return column.in_([value])
            elif operator == FilterOperator.NOT_IN:
                if isinstance(value, (list, tuple)):
                    return ~column.in_(value)
                else:
                    return ~column.in_([value])
            elif operator == FilterOperator.IS_NULL:
                return column.is_(None)
            elif operator == FilterOperator.IS_NOT_NULL:
                return column.isnot(None)
            elif operator == FilterOperator.BETWEEN:
                if value2 is not None:
                    return column.between(value, value2)
                else:
                    logger.warning("BETWEEN operator requires value2")
                    return None
            else:
                logger.warning(f"Unsupported filter operator: {operator}")
                return None
        except Exception as e:
            logger.error(f"Error building filter condition: {e}")
            return None

    def apply_sorting(
        self,
        query: Query,
        model: Type,
        sort_criteria: List[SortCriteria]
    ) -> Query:
        """
        Apply sorting to a SQLAlchemy query.
        
        Args:
            query: SQLAlchemy query object
            model: SQLAlchemy model class
            sort_criteria: List of sort criteria
            
        Returns:
            Sorted query object
        """
        for sort_criterion in sort_criteria:
            try:
                column = getattr(model, sort_criterion.field)
                if sort_criterion.order == SortOrder.DESC:
                    query = query.order_by(desc(column))
                else:
                    query = query.order_by(asc(column))
            except AttributeError:
                logger.warning(f"Invalid sort field: {sort_criterion.field} for model {model.__name__}")
            except Exception as e:
                logger.error(f"Error applying sort: {e}")
        
        return query

    def paginate(
        self,
        query: Query,
        pagination_params: PaginationParams
    ) -> PaginationResult:
        """
        Apply pagination to a query and return results with metadata.
        
        Args:
            query: SQLAlchemy query object
            pagination_params: Pagination parameters
            
        Returns:
            Pagination result with metadata
        """
        # Validate pagination parameters
        skip = max(0, pagination_params.skip)
        limit = min(max(1, pagination_params.limit), pagination_params.max_limit)
        
        # Get total count (optimized)
        total = self._get_total_count(query)
        
        # Apply pagination
        items = query.offset(skip).limit(limit).all()
        
        # Calculate metadata
        current_page = (skip // limit) + 1
        total_pages = (total + limit - 1) // limit
        has_next = skip + limit < total
        has_previous = skip > 0
        
        return PaginationResult(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            has_next=has_next,
            has_previous=has_previous,
            total_pages=total_pages,
            current_page=current_page
        )

    def _get_total_count(self, query: Query) -> int:
        """Get total count for a query efficiently."""
        try:
            # Use count() for better performance on large datasets
            count_query = query.statement.with_only_columns([func.count()]).order_by(None)
            return self.db.execute(count_query).scalar()
        except Exception:
            # Fallback to simple count
            return query.count()

    def optimize_query_for_large_dataset(
        self,
        query: Query,
        model: Type,
        cursor_field: str = "id",
        cursor_value: Optional[Any] = None,
        limit: int = 50
    ) -> Tuple[List[Any], Optional[Any]]:
        """
        Optimize query for large datasets using cursor-based pagination.
        
        Args:
            query: SQLAlchemy query object
            model: SQLAlchemy model class
            cursor_field: Field to use for cursor pagination
            cursor_value: Current cursor value
            limit: Number of items to fetch
            
        Returns:
            Tuple of (items, next_cursor)
        """
        try:
            cursor_column = getattr(model, cursor_field)
            
            if cursor_value is not None:
                query = query.filter(cursor_column > cursor_value)
            
            query = query.order_by(asc(cursor_column))
            items = query.limit(limit + 1).all()  # Fetch one extra to check if there's more
            
            has_more = len(items) > limit
            if has_more:
                items = items[:-1]  # Remove the extra item
                next_cursor = getattr(items[-1], cursor_field) if items else None
            else:
                next_cursor = None
            
            return items, next_cursor
            
        except Exception as e:
            logger.error(f"Error in cursor-based pagination: {e}")
            return [], None


def parse_filter_params(
    filter_params: Optional[str] = None
) -> List[FilterCriteria]:
    """
    Parse filter parameters from query string.
    
    Format: field:operator:value,field2:operator2:value2
    Example: name:contains:john,age:gte:18,status:in:active,pending
    
    Args:
        filter_params: Filter parameters string
        
    Returns:
        List of filter criteria
    """
    filters = []
    
    if not filter_params:
        return filters
    
    try:
        filter_parts = filter_params.split(',')
        for part in filter_parts:
            components = part.strip().split(':', 2)
            if len(components) >= 3:
                field, operator_str, value_str = components[0], components[1], components[2]
                
                try:
                    operator = FilterOperator(operator_str)
                    value = parse_filter_value(value_str, operator)
                    
                    filters.append(FilterCriteria(
                        field=field,
                        operator=operator,
                        value=value
                    ))
                except ValueError:
                    logger.warning(f"Invalid filter operator: {operator_str}")
            else:
                logger.warning(f"Invalid filter format: {part}")
    except Exception as e:
        logger.error(f"Error parsing filter params: {e}")
    
    return filters


def parse_sort_params(
    sort_params: Optional[str] = None
) -> List[SortCriteria]:
    """
    Parse sort parameters from query string.
    
    Format: field:order,field2:order2
    Example: created_at:desc,name:asc
    
    Args:
        sort_params: Sort parameters string
        
    Returns:
        List of sort criteria
    """
    sorts = []
    
    if not sort_params:
        return sorts
    
    try:
        sort_parts = sort_params.split(',')
        for part in sort_parts:
            components = part.strip().split(':')
            if len(components) == 2:
                field, order_str = components[0], components[1]
                try:
                    order = SortOrder(order_str)
                    sorts.append(SortCriteria(field=field, order=order))
                except ValueError:
                    logger.warning(f"Invalid sort order: {order_str}")
            elif len(components) == 1:
                # Default to ascending if no order specified
                sorts.append(SortCriteria(field=components[0], order=SortOrder.ASC))
            else:
                logger.warning(f"Invalid sort format: {part}")
    except Exception as e:
        logger.error(f"Error parsing sort params: {e}")
    
    return sorts


def parse_filter_value(value_str: str, operator: FilterOperator) -> Any:
    """Parse filter value based on operator type."""
    if operator in [FilterOperator.IN, FilterOperator.NOT_IN]:
        # Handle list values
        return [v.strip() for v in value_str.split('|')]
    elif operator in [FilterOperator.IS_NULL, FilterOperator.IS_NOT_NULL]:
        # These operators don't need values
        return None
    else:
        # Try to convert to appropriate type
        return convert_value_type(value_str)


def convert_value_type(value_str: str) -> Any:
    """Convert string value to appropriate Python type."""
    # Try boolean
    if value_str.lower() in ['true', 'false']:
        return value_str.lower() == 'true'
    
    # Try integer
    try:
        if '.' not in value_str:
            return int(value_str)
    except ValueError:
        pass
    
    # Try float
    try:
        return float(value_str)
    except ValueError:
        pass
    
    # Try datetime
    try:
        return datetime.fromisoformat(value_str.replace('Z', '+00:00'))
    except ValueError:
        pass
    
    # Return as string
    return value_str


# FastAPI dependencies for common pagination scenarios
def create_pagination_dependency(
    default_limit: int = 50,
    max_limit: int = 1000
):
    """Create a FastAPI dependency for pagination parameters."""
    
    def pagination_dependency(
        skip: int = FastAPIQuery(0, ge=0, description="Number of items to skip"),
        limit: int = FastAPIQuery(default_limit, ge=1, le=max_limit, description="Number of items to return")
    ) -> PaginationParams:
        return PaginationParams(skip=skip, limit=limit, max_limit=max_limit)
    
    return pagination_dependency


def create_filter_dependency():
    """Create a FastAPI dependency for filter parameters."""
    
    def filter_dependency(
        filters: Optional[str] = FastAPIQuery(
            None,
            description="Filter parameters (format: field:operator:value,field2:operator2:value2)"
        )
    ) -> List[FilterCriteria]:
        return parse_filter_params(filters)
    
    return filter_dependency


def create_sort_dependency():
    """Create a FastAPI dependency for sort parameters."""
    
    def sort_dependency(
        sort: Optional[str] = FastAPIQuery(
            None,
            description="Sort parameters (format: field:order,field2:order2)"
        )
    ) -> List[SortCriteria]:
        return parse_sort_params(sort)
    
    return sort_dependency


# Pre-defined dependencies
StandardPagination = create_pagination_dependency()
FilterParams = create_filter_dependency()
SortParams = create_sort_dependency()
