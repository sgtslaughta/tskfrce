/**
 * @fileoverview Services index for TaaskMaaster
 * @description Central export point for all API services
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

// Core API utilities
export * from './api';

// Authentication service
export * from './authService';

// Task management service
export * from './taskService';

// Gamification service
export * from './gamificationService';

// Goal management service
export * from './goalService';

// List management service
export * from './listService';

// Workflow and messaging services
export * from './commentService';
export * from './messagingService';
export * from './websocketService';
export * from './notificationService';
export * from './taskHistoryService';

// Re-export service instances for convenience
export { authService } from './authService';
export { taskService } from './taskService';
export { gamificationService } from './gamificationService';
export { goalService } from './goalService';
export { userService } from './userService';
export { ListService } from './listService';
export { websocketService } from './websocketService';
export { notificationService } from './notificationService';
export { taskHistoryService } from './taskHistoryService';
