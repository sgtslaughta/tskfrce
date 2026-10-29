# API Conversion Plan: URI Parameters → JSON Request Bodies

## Overview

This document outlines the plan to convert API endpoints from using URI parameters to JSON request bodies. This conversion will solve route ordering issues, improve API consistency, and make the system more maintainable.

## Current Issues

1. **Route ordering conflicts** - More specific routes must be defined before general ones
2. **Limited parameter flexibility** - URI parameters are restrictive
3. **Inconsistent API design** - Mix of URI params and JSON bodies
4. **Harder to extend** - Adding new parameters requires breaking changes
5. **Validation complexity** - URI parameter validation is more complex

## Proposed Solution

Convert all URI parameter-based endpoints to use JSON request bodies, creating a consistent and extensible API design.

## Phase 1: High Priority Conversions (Immediate Fix)

### 1. Task Completion Endpoint

**Current:**
```
POST /{task_id}/complete?actual_hours=2.5
```

**New:**
```
POST /tasks/complete
```

**Request Body:**
```json
{
  "task_id": 11,
  "actual_hours": 2.5
}
```

**Response:**
```json
{
  "id": 11,
  "title": "Fix Broken Fence",
  "status": "done",
  "completed_at": "2025-08-26T17:57:24.369437",
  "actual_hours": 2.5
}
```

### 2. Individual Task Operations

**Current:**
```
GET /{task_id}
PUT /{task_id}
DELETE /{task_id}
```

**New:**
```
POST /tasks/get
POST /tasks/update
POST /tasks/delete
```

**Request Bodies:**

**Get Task:**
```json
{
  "task_id": 11
}
```

**Update Task:**
```json
{
  "task_id": 11,
  "updates": {
    "title": "Updated title",
    "description": "Updated description",
    "priority": "high",
    "due_date": "2025-08-27T16:00:00"
  }
}
```

**Delete Task:**
```json
{
  "task_id": 11
}
```

## Phase 2: Medium Priority Conversions

### 3. Template Operations

**Current:**
```
POST /templates/{template_id}/create
```

**New:**
```
POST /templates/create-from-template
```

**Request Body:**
```json
{
  "template_id": 5,
  "title": "Custom title",
  "description": "Custom description",
  "assigned_to_id": 2
}
```

### 4. List Operations

**Current:**
```
GET /lists/{list_id}/tasks
```

**New:**
```
POST /lists/get-tasks
```

**Request Body:**
```json
{
  "list_id": 3,
  "include_completed": false,
  "limit": 50,
  "offset": 0
}
```

### 5. Category Operations

**Current:**
```
GET /categories/{category_id}
PUT /categories/{category_id}
DELETE /categories/{category_id}
```

**New:**
```
POST /categories/get
POST /categories/update
POST /categories/delete
```

## Phase 3: Low Priority (Already Good)

- Bulk operations (already using JSON)
- Export operations (already using JSON)
- Basic CRUD operations (create, list)

## Implementation Plan

### Step 1: Create New API Endpoints

#### Backend Changes Required:

1. **Create new request schemas** in `backend/app/schemas/task.py`:
   ```python
   class TaskCompleteRequest(BaseModel):
       task_id: int
       actual_hours: Optional[float] = None

   class TaskGetRequest(BaseModel):
       task_id: int

   class TaskUpdateRequest(BaseModel):
       task_id: int
       updates: TaskUpdate

   class TaskDeleteRequest(BaseModel):
       task_id: int
   ```

2. **Add new API endpoints** in `backend/app/api/tasks.py`:
   ```python
   @router.post("/complete", response_model=TaskResponse)
   async def complete_task_json(request: TaskCompleteRequest, ...)

   @router.post("/get", response_model=TaskResponse)
   async def get_task_json(request: TaskGetRequest, ...)

   @router.post("/update", response_model=TaskResponse)
   async def update_task_json(request: TaskUpdateRequest, ...)

   @router.post("/delete", status_code=status.HTTP_204_NO_CONTENT)
   async def delete_task_json(request: TaskDeleteRequest, ...)
   ```

3. **Update service methods** in `backend/app/services/task_service.py`:
   ```python
   def complete_task_by_id(self, task_id: int, actual_hours: Optional[float] = None) -> Optional[Task]:
       # Implementation

   def get_task_by_id(self, task_id: int) -> Optional[Task]:
       # Implementation

   def update_task_by_id(self, task_id: int, updates: dict) -> Optional[Task]:
       # Implementation

   def delete_task_by_id(self, task_id: int) -> bool:
       # Implementation
   ```

### Step 2: Update Frontend Services

#### Frontend Changes Required:

1. **Update task service** in `frontend/src/services/taskService.ts`:
   ```typescript
   // New methods
   async completeTask(taskId: number, actualHours?: number): Promise<Task> {
     const response = await this.api.post('/tasks/complete', {
       task_id: taskId,
       actual_hours: actualHours
     });
     return response.data;
   }

   async getTask(taskId: number): Promise<Task> {
     const response = await this.api.post('/tasks/get', {
       task_id: taskId
     });
     return response.data;
   }

   async updateTask(taskId: number, updates: Partial<Task>): Promise<Task> {
     const response = await this.api.post('/tasks/update', {
       task_id: taskId,
       updates
     });
     return response.data;
   }

   async deleteTask(taskId: number): Promise<void> {
     await this.api.post('/tasks/delete', {
       task_id: taskId
     });
   }
   ```

2. **Update components** to use new methods:
   - `frontend/src/components/tasks/TaskCard.tsx`
   - `frontend/src/components/tasks/TaskDetailModal.tsx`
   - `frontend/src/components/tasks/TaskList.tsx`

### Step 3: Migration Strategy

1. **Phase 1: Add new endpoints** (backward compatible)
2. **Phase 2: Update frontend** to use new endpoints
3. **Phase 3: Add deprecation warnings** to old endpoints
4. **Phase 4: Remove old endpoints** in future version

### Step 4: Testing Strategy

1. **Unit tests** for new service methods
2. **Integration tests** for new API endpoints
3. **Frontend tests** for updated components
4. **End-to-end tests** for complete workflows

## Benefits

### Technical Benefits:
- ✅ **No route ordering issues**
- ✅ **Consistent API design**
- ✅ **Easier to extend**
- ✅ **Better validation**
- ✅ **More maintainable**

### Business Benefits:
- ✅ **Faster development** - no route conflicts
- ✅ **Better user experience** - consistent API behavior
- ✅ **Easier maintenance** - unified patterns
- ✅ **Future-proof** - extensible design

## Migration Timeline

### Week 1: Task Completion Endpoint
- [ ] Create new schemas
- [ ] Add new API endpoint
- [ ] Update service method
- [ ] Update frontend service
- [ ] Update components
- [ ] Test thoroughly

### Week 2: Individual Task Operations
- [ ] Create new schemas
- [ ] Add new API endpoints
- [ ] Update service methods
- [ ] Update frontend services
- [ ] Update components
- [ ] Test thoroughly

### Week 3: Template and List Operations
- [ ] Create new schemas
- [ ] Add new API endpoints
- [ ] Update service methods
- [ ] Update frontend services
- [ ] Update components
- [ ] Test thoroughly

### Week 4: Cleanup and Documentation
- [ ] Add deprecation warnings
- [ ] Update API documentation
- [ ] Update frontend documentation
- [ ] Performance testing
- [ ] Security review

## Risk Mitigation

1. **Backward Compatibility** - Keep old endpoints during transition
2. **Gradual Migration** - Convert one endpoint at a time
3. **Comprehensive Testing** - Test both old and new endpoints
4. **Rollback Plan** - Ability to revert if issues arise
5. **Documentation** - Clear migration guides for developers

## Success Metrics

1. **Zero route ordering issues**
2. **Consistent API response times**
3. **Improved developer experience**
4. **Reduced API maintenance overhead**
5. **Successful migration of all endpoints**

## Conclusion

This conversion will create a more robust, maintainable, and extensible API architecture. The JSON request body approach solves the current route ordering issues and provides a foundation for future API enhancements.
