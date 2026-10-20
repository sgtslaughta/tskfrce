/**
 * @fileoverview Dashboard page component for TaaskMaaster
 * @description A comprehensive dashboard with welcome section, stats, progress, and gamification elements
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card,
  Text,
  Group,
  Stack,
  Button,
  Grid,
  Loader,
  Alert,
  ThemeIcon,
  Title,
  Paper,
  Divider,
  Center,
  Badge,
  Progress,
  RingProgress,
  SimpleGrid,
  Box,
  Modal,
  ScrollArea
} from '@mantine/core';
import { Carousel } from '@mantine/carousel';
import { useRef } from 'react';
import Autoplay from 'embla-carousel-autoplay';
import '@mantine/carousel/styles.css';
import { LineChart, DonutChart, BarChart, AreaChart, PieChart } from '@mantine/charts';
import '@mantine/charts/styles.css';
import '@mantine/dates/styles.css';
import { 
  IconHome,
  IconCheckbox,
  IconTrophy,
  IconUsers,
  IconChartBar,
  IconCalendar,
  IconStar,
  IconFlame,
  IconSchool,
  IconSettings,
  IconArrowUpRight,
  IconArrowDownRight,
  IconClock,
  IconFolderOpen,
  IconProgress,
  IconTargetArrow,
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconCalendarTime
} from '@tabler/icons-react';
import { AppLayout } from '../layout/AppLayout';
import { gamificationService, goalService, taskService } from '../../services';
import BlurText from '../ui/BlurText';
import TaskCalendar from '../calendar/TaskCalendar';
import { TaskDrawer } from '../tasks/TaskDrawer';
import { useUnifiedAuth } from '../../contexts/UnifiedAuthContext';

/**
 * @description User interface
 */
interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  role?: string;
  points?: number;
  level?: number;
}

/**
 * @description Dashboard statistics interface
 */
export interface DashboardStats {
  totalPoints: number;
  currentLevel: number;
  tasksCompleted: number;
  tasksPending: number;
  streakDays: number;
  achievements: number;
  activeGoals: number;
  completedGoals: number;
  upcomingTasks?: number;
  overdueTasks?: number;
}

/**
 * @description Recent activity interface
 */
export interface RecentActivity {
  id: string;
  type: 'task_completed' | 'points_earned' | 'achievement_unlocked' | 'goal_reached';
  title: string;
  description: string;
  timestamp: string;
  points?: number;
}

/**
 * @description Dashboard component props interface
 */
export interface DashboardProps {
  /** User information */
  user?: User | null;
  /** Function called when a quick action is performed */
  onQuickAction?: (action: string) => void;
  /** Function called when logout is requested */
  onLogout?: () => void;
  /** Function called when navigation is requested */
  onNavigation?: (view: string) => void;
  /** Function called when navigating from notifications */
  onNotificationNavigation?: (pageId: string, taskId?: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether this dashboard is embedded (e.g., in My Hub) */
  isEmbedded?: boolean;
}


/**
 * @description Dashboard component
 * 
 * A comprehensive dashboard that provides:
 * - Welcome section with user greeting
 * - Quick stats and progress overview
 * - Recent activity feed
 * - Quick action buttons
 * - Gamification progress indicators
 * - Dark mode support
 */
export const Dashboard: React.FC<DashboardProps> = ({
  user,
  onQuickAction,
  onLogout,
  onNavigation,
  onNotificationNavigation,
  className,
  isEmbedded = false,
}) => {
  // Get authenticated user for permission checking
  const { user: authUser } = useUnifiedAuth();
  const autoplay = useRef(Autoplay({ delay: 4000 }));

  const [stats, setStats] = useState<DashboardStats>({
    totalPoints: 0,
    currentLevel: 1,
    tasksCompleted: 0,
    tasksPending: 0,
    streakDays: 0,
    achievements: 0,
    activeGoals: 0,
    completedGoals: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>({
    categoryBreakdown: [],
    priorityDistribution: [],
    statusFlow: [],
    timeMetrics: [],
    trendData: [],
    weeklyData: []
  });
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [taskModalOpened, setTaskModalOpened] = useState(false);
  const [modalTasks, setModalTasks] = useState<any[]>([]);
  const [modalTitle, setModalTitle] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [drawerOpened, setDrawerOpened] = useState(false);

  /**
   * @description Handle notification navigation to open TaskDrawer
   */
  useEffect(() => {
    const handleNotificationNav = (pageId: string, taskId?: number) => {
      if (pageId === 'dashboard' && taskId) {
        setSelectedTaskId(taskId);
        setDrawerOpened(true);
      }
    };
    
    // Set up global navigation handler for notifications
    (window as any).__notificationNavHandler = handleNotificationNav;
    
    // Also trigger onNotificationNavigation callback if provided
    if (onNotificationNavigation) {
      // Register the callback - this creates a two-way communication
      // AppRouter can call this directly, or notifications can use the global handler
    }
    
    // Cleanup on unmount
    return () => {
      (window as any).__notificationNavHandler = null;
    };
  }, [onNotificationNavigation]);

  /**
   * @description Calculate weekly activity data from tasks
   */
  const calculateWeeklyData = useCallback((tasks: any[]) => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    
    const weeklyData = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Debug logging removed - no longer needed
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(weekStart);
      currentDay.setDate(weekStart.getDate() + i);
      
      // Filter tasks that were ASSIGNED/CREATED on this specific day
      const assignedTasks = tasks.filter(task => {
        const taskDate = new Date(task.created_at);
        return taskDate.toDateString() === currentDay.toDateString();
      });
      
      // Filter tasks that were COMPLETED on this specific day
      const completedTasks = tasks.filter(task => {
        if (task.status !== 'done' || !task.completed_at) return false;
        const taskDate = new Date(task.completed_at);
        return taskDate.toDateString() === currentDay.toDateString();
      });
      
      // Calculate points for completed tasks on this day
      const dayPoints = completedTasks.reduce((sum, task) => sum + (task.points || 0), 0);
      
      // Debug logging removed - no longer needed
      
      weeklyData.push({
        day: dayNames[i],
        assigned: assignedTasks.length,
        completed: completedTasks.length,
        points: dayPoints
      });
    }
    
    return weeklyData;
  }, []);

  /**
   * @description Calculate analytics from task data
   */
  const calculateAnalytics = useCallback((tasks: any[]) => {
    // Category breakdown
    const categoryMap = new Map();
    const priorityMap = new Map();
    const statusMap = new Map();
    
    tasks.forEach(task => {
      // Category breakdown
      const category = task.category?.name || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      
      // Priority distribution
      priorityMap.set(task.priority, (priorityMap.get(task.priority) || 0) + 1);
      
      // Status distribution
      statusMap.set(task.status, (statusMap.get(task.status) || 0) + 1);
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    }));

    const priorityDistribution = Array.from(priorityMap.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: name === 'urgent' ? '#fa5252' : name === 'high' ? '#fd7e14' : name === 'medium' ? '#fab005' : '#51cf66'
    }));

    const statusFlow = Array.from(statusMap.entries()).map(([name, value]) => ({
      name: name.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      value,
      percentage: Math.round((value / tasks.length) * 100)
    }));

    // Time metrics calculations
    const completedTasks = tasks.filter(task => task.status === 'done' && task.completed_at);
    const avgCompletionTime = completedTasks.length > 0 
      ? completedTasks.reduce((acc, task) => {
          const created = new Date(task.created_at);
          const completed = new Date(task.completed_at);
          return acc + (completed.getTime() - created.getTime());
        }, 0) / completedTasks.length / (1000 * 60 * 60 * 24)
      : 0;

    // Calculate this week vs last week for trends (simplified)
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisWeekTasks = tasks.filter(t => new Date(t.created_at) > thisWeek).length;
    
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 14);
    const lastWeekEnd = new Date();
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
    const lastWeekTasks = tasks.filter(t => {
      const taskDate = new Date(t.created_at);
      return taskDate > lastWeek && taskDate <= lastWeekEnd;
    }).length;
    
    const weeklyTaskChange = lastWeekTasks > 0 ? Math.round(((thisWeekTasks - lastWeekTasks) / lastWeekTasks) * 100) : 0;
    const completionRate = Math.round((completedTasks.length / Math.max(tasks.length, 1)) * 100);

    const timeMetrics = [
      { label: 'Avg Completion Time', value: Math.round(avgCompletionTime * 10) / 10, unit: 'days', icon: 'IconClock', trend: 'down', change: 0 },
      { label: 'Tasks This Week', value: thisWeekTasks, unit: 'tasks', icon: 'IconTrendingUp', trend: weeklyTaskChange > 0 ? 'up' : weeklyTaskChange < 0 ? 'down' : 'neutral', change: Math.abs(weeklyTaskChange) },
      { label: 'Completion Rate', value: completionRate, unit: '%', icon: 'IconTargetArrow', trend: completionRate > 50 ? 'up' : 'down', change: 0 },
      { label: 'Active Categories', value: categoryMap.size, unit: 'cats', icon: 'IconFolderOpen', trend: 'neutral', change: 0 }
    ];

    const weeklyData = calculateWeeklyData(tasks);
    
    setAnalyticsData({
      categoryBreakdown,
      priorityDistribution,
      statusFlow,
      timeMetrics,
      trendData: [], // Will be populated with real trend data later
      weeklyData
    });
  }, [calculateWeeklyData]);

  /**
   * @description Load recent activity
   */
  const loadRecentActivity = useCallback(async (userId: number) => {
    try {
      const activities: RecentActivity[] = [];

      // Get recent points transactions
      const pointsHistory = await gamificationService.getUserPointsHistory(userId, { limit: 5 });
      pointsHistory.points.forEach(point => {
        activities.push({
          id: `points_${point.id}`,
          type: 'points_earned',
          title: `Earned ${point.amount} points`,
          description: point.description || 'Points earned',
          timestamp: point.created_at,
          points: point.amount,
        });
      });

      // Get recent achievements
      const achievements = await gamificationService.getUserAchievements(userId);
      achievements.slice(0, 3).forEach(achievement => {
        activities.push({
          id: `achievement_${achievement.id}`,
          type: 'achievement_unlocked',
          title: `Unlocked "${achievement.achievement.name}"`,
          description: achievement.achievement.description,
          timestamp: achievement.awarded_at,
        });
      });

      // Sort by timestamp and take the most recent 5
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      setRecentActivity(sortedActivities);
    } catch (err) {
      console.error('Error loading recent activity:', err);
      // Set some default activity if API fails
      setRecentActivity([
        {
          id: '1',
          type: 'task_completed',
          title: 'Completed task "Clean the kitchen"',
          description: 'Daily chore completed',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: '2',
          type: 'points_earned',
          title: 'Earned 50 points',
          description: 'Points earned for completing daily goal',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          points: 50,
        },
        {
          id: '3',
          type: 'achievement_unlocked',
          title: 'Unlocked "Task Master"',
          description: 'Completed 10 tasks in a week',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);
    }
  }, []);

  /**
   * @description Load dashboard data
   */
  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      const userId = parseInt(user.id);
      
      // Load gamification stats
      const gamificationStats = await gamificationService.getDashboardStats(userId);
      
      // Load goal stats
      const goalStats = await goalService.getDashboardGoalStats();
      
      // Load task stats (using task service)
      const taskResponse = await taskService.getTasks();
      const allTasks = taskResponse.tasks;
      
      // Filter to only tasks for current user (created by OR assigned to)
      const userTasks = allTasks.filter(task => 
        task.created_by_id === userId || task.assigned_to_id === userId
      );
      
      // Store user tasks for calendar
      setUserTasks(userTasks);
      
      const tasksCompleted = userTasks.filter(t => t.status === 'done').length;
      const tasksPending = userTasks.filter(t => t.status !== 'done').length;
      
      // Calculate upcoming and overdue tasks (using same logic as TaskDrawer)
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const overdueTasks = userTasks.filter(t => {
        if (t.status === 'done' || !t.due_date) return false;
        const due = new Date(t.due_date);
        const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const diffTime = dueDateOnly.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays < 0; // Past due date
      });
      
      const upcomingTasks = userTasks.filter(t => {
        if (t.status === 'done' || !t.due_date) return false;
        const due = new Date(t.due_date);
        const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const diffTime = dueDateOnly.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7; // Due within next 7 days (excluding overdue)
      });

      // Calculate analytics data
      calculateAnalytics(userTasks);

      // Combine all stats
      setStats({
        totalPoints: gamificationStats.totalPoints,
        currentLevel: gamificationStats.currentLevel,
        tasksCompleted,
        tasksPending,
        streakDays: gamificationStats.streakDays,
        achievements: gamificationStats.achievements,
        activeGoals: goalStats.activeGoals,
        completedGoals: goalStats.completedGoals,
        upcomingTasks: upcomingTasks.length,
        overdueTasks: overdueTasks.length,
      });

      // Store task arrays for modals
      setModalTasks([]); // Reset modal tasks

      // Load recent activity
      await loadRecentActivity(userId);

    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, calculateAnalytics, loadRecentActivity]);

  /**
   * @description Load data on component mount
   */
  useEffect(() => {
    loadDashboardData();
  }, [user?.id, loadDashboardData]);

  /**
   * @description Handle clicking on upcoming tasks metric
   */
  const handleUpcomingTasksClick = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const upcomingTasks = userTasks.filter(t => {
      if (t.status === 'done' || !t.due_date) return false;
      const due = new Date(t.due_date);
      const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const diffTime = dueDateOnly.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7; // Due within next 7 days (excluding overdue)
    });
    setModalTasks(upcomingTasks);
    setModalTitle('Upcoming Tasks (Next 7 Days)');
    setTaskModalOpened(true);
  };

  /**
   * @description Handle clicking on overdue tasks metric
   */
  const handleOverdueTasksClick = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const overdueTasks = userTasks.filter(t => {
      if (t.status === 'done' || !t.due_date) return false;
      const due = new Date(t.due_date);
      const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const diffTime = dueDateOnly.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays < 0; // Past due date
    });
    setModalTasks(overdueTasks);
    setModalTitle('Overdue Tasks');
    setTaskModalOpened(true);
  };

  /**
   * @description Handle clicking on a task in the modal
   */
  const handleTaskItemClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setTaskModalOpened(false);
    setDrawerOpened(true);
  };

  /**
   * @description Handle task updates from drawer
   */
  const handleTaskUpdate = async () => {
    loadDashboardData(); // Refresh data when tasks are updated
  };

  /**
   * @description Handle task save from drawer
   */
  const handleTaskSave = async (taskData: any) => {
    // TaskDrawer handles the actual save, we just refresh data
    loadDashboardData();
  };

  /**
   * @description Handle task delete from drawer
   */
  const handleTaskDelete = async (taskId: number) => {
    // TaskDrawer handles the actual delete, we just refresh data
    loadDashboardData();
  };


  /**
   * @description Get appropriate greeting based on time of day
   */
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  /**
   * @description Format timestamp for display
   */
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };


  const renderContent = (content: React.ReactNode) => {
    if (isEmbedded) {
      return content;
    }
    return (
      <AppLayout
        currentPage="dashboard"
        onNavigate={(pageId) => onNavigation?.(pageId)}
        user={user ? {
          id: user.id.toString(),
          username: user.username,
          email: user.email,
          role: user.role || 'user',
          points: undefined,
          level: undefined
        } : null}
        onLogout={onLogout}
      >
        {content}
      </AppLayout>
    );
  };

  if (loading) {
    return renderContent(
      <Center h={400}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading dashboard...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return renderContent(
      <Alert color="red" title="Error loading dashboard">
        <Text>{error}</Text>
        <Button 
          variant="subtle" 
          color="red" 
          size="sm" 
          mt="sm"
          onClick={loadDashboardData}
        >
          Try again
        </Button>
      </Alert>
    );
  }

  // Prepare chart data
  const taskProgressData = [
    { name: 'Completed', value: stats.tasksCompleted, color: '#51cf66' },
    { name: 'Pending', value: stats.tasksPending, color: '#ffd43b' }
  ];

  // Use real weekly data from analytics
  const weeklyData = analyticsData.weeklyData.length > 0 ? analyticsData.weeklyData : [
    { day: 'Sun', assigned: 0, completed: 0, points: 0 },
    { day: 'Mon', assigned: 0, completed: 0, points: 0 },
    { day: 'Tue', assigned: 0, completed: 0, points: 0 },
    { day: 'Wed', assigned: 0, completed: 0, points: 0 },
    { day: 'Thu', assigned: 0, completed: 0, points: 0 },
    { day: 'Fri', assigned: 0, completed: 0, points: 0 },
    { day: 'Sat', assigned: 0, completed: 0, points: 0 }
  ];

  const monthlyGoalProgress = (stats.completedGoals / (stats.activeGoals + stats.completedGoals)) * 100 || 0;

  return renderContent(
    <Stack gap="md">
      {/* Compact Header with Animated Welcome */}
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" align="center">
          <div>
            <div style={{ fontSize: 'var(--mantine-font-size-lg)', fontWeight: 700, marginBottom: '4px' }}>
              <BlurText 
                text={`${getGreeting()}! 👋`}
                delay={100}
                animateBy="words"
                direction="top"
                className=""
                onAnimationComplete={() => {}}
              />
            </div>
            <div style={{ fontSize: 'var(--mantine-font-size-sm)', color: 'var(--mantine-color-dimmed)' }}>
              <BlurText 
                text="Ready to tackle today's tasks?"
                delay={80}
                animateBy="words"
                direction="top"
                className=""
              />
            </div>
          </div>
          <Group gap="md" visibleFrom="md">
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700} c="blue">{stats.totalPoints}</Text>
              <Text size="xs" c="dimmed">Points</Text>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text size="xl" fw={700} c="violet">Level {stats.currentLevel}</Text>
              <Text size="xs" c="dimmed">Current</Text>
            </div>
            
            {/* Quick Access Buttons */}
            <Group gap="xs">
              <Button
                variant="light"
                color="blue"
                size="sm"
                leftSection={<IconCalendarTime size={16} />}
                onClick={handleUpcomingTasksClick}
                disabled={!stats.upcomingTasks || stats.upcomingTasks === 0}
              >
                {stats.upcomingTasks || 0} Upcoming
              </Button>
              
              <Button
                variant={stats.overdueTasks && stats.overdueTasks > 0 ? "filled" : "light"}
                color="red"
                size="sm"
                leftSection={<IconAlertTriangle size={16} />}
                onClick={handleOverdueTasksClick}
                disabled={!stats.overdueTasks || stats.overdueTasks === 0}
              >
                {stats.overdueTasks || 0} Overdue
              </Button>
            </Group>
          </Group>
        </Group>
        
        {/* Mobile Quick Access Buttons */}
        <Group gap="xs" hiddenFrom="md" mt="sm">
          <Button
            variant="light"
            color="blue"
            size="xs"
            leftSection={<IconCalendarTime size={14} />}
            onClick={handleUpcomingTasksClick}
            disabled={!stats.upcomingTasks || stats.upcomingTasks === 0}
          >
            {stats.upcomingTasks || 0} Upcoming
          </Button>
          
          <Button
            variant={stats.overdueTasks && stats.overdueTasks > 0 ? "filled" : "light"}
            color="red"
            size="xs"
            leftSection={<IconAlertTriangle size={14} />}
            onClick={handleOverdueTasksClick}
            disabled={!stats.overdueTasks || stats.overdueTasks === 0}
          >
            {stats.overdueTasks || 0} Overdue
          </Button>
        </Group>
      </Paper>

      {/* Analytics Carousel - Stock Ticker Style */}
      <Box h={40} mb="xl">
        <Carousel
          withIndicators={true}
          withControls={true}
          plugins={[autoplay.current]}
          slideSize="240px"
          slideGap="sm"
          styles={{
            root: { height: '100%' },
            container: { height: '100%' },
            slide: { 
              padding: '0 4px',
              flex: '0 0 240px',
              maxWidth: '240px'
            },
            controls: {
              '&[dataPosition="left"]': {
                left: 'calc(50% - 60px)',
                top: 'calc(100% + 24px)',
                transform: 'translateX(-50%)',
                position: 'absolute'
              },
              '&[dataPosition="right"]': {
                right: 'calc(50% - 60px)',
                top: 'calc(100% + 24px)',
                transform: 'translateX(50%)',
                position: 'absolute'
              }
            },
            indicators: {
              bottom: '-40px',
              display: 'flex',
              justifyContent: 'center'
            }
          }}
        >
          {/* Slide 1: Tasks Done */}
          <Carousel.Slide>
            <Card shadow="sm" padding="xs" radius="sm" withBorder h="100%" style={{ display: 'flex', alignItems: 'center' }}>
              <Group gap="xs" align="center" wrap="nowrap" w="100%">
                <ThemeIcon size="sm" color="green" variant="light">
                  <IconCheckbox size={14} />
                </ThemeIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" mb={1} truncate>Tasks Done</Text>
                  <Group gap="xs" align="baseline" wrap="nowrap">
                    <Text size="md" fw={700}>{stats.tasksCompleted}</Text>
                    <Progress 
                      value={Math.min((stats.tasksCompleted / (stats.tasksCompleted + stats.tasksPending)) * 100, 100)} 
                      color="green" 
                      size="xs" 
                      w={50}
                    />
                  </Group>
                </div>
              </Group>
            </Card>
          </Carousel.Slide>

          {/* Slide 2: Streak */}
          <Carousel.Slide>
            <Card shadow="sm" padding="xs" radius="sm" withBorder h="100%" style={{ display: 'flex', alignItems: 'center' }}>
              <Group gap="xs" align="center" wrap="nowrap" w="100%">
                <ThemeIcon size="sm" color="orange" variant="light">
                  <IconFlame size={14} />
                </ThemeIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" mb={1} truncate>Streak</Text>
                  <Group gap="xs" align="baseline" wrap="nowrap">
                    <Text size="md" fw={700}>{stats.streakDays}</Text>
                    <Text size="xs" c="dimmed">days</Text>
                  </Group>
                </div>
              </Group>
            </Card>
          </Carousel.Slide>

          {/* Slide 3: Goals */}
          <Carousel.Slide>
            <Card shadow="sm" padding="xs" radius="sm" withBorder h="100%" style={{ display: 'flex', alignItems: 'center' }}>
              <Group gap="xs" align="center" wrap="nowrap" w="100%">
                <ThemeIcon size="sm" color="yellow" variant="light">
                  <IconTrophy size={14} />
                </ThemeIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" mb={1} truncate>Goals</Text>
                  <Group gap="xs" align="baseline" wrap="nowrap">
                    <Text size="md" fw={700}>{stats.completedGoals}/{stats.activeGoals + stats.completedGoals}</Text>
                    <Progress 
                      value={monthlyGoalProgress} 
                      color="yellow" 
                      size="xs" 
                      w={50}
                    />
                  </Group>
                </div>
              </Group>
            </Card>
          </Carousel.Slide>

          {/* Slide 4: Achievements */}
          <Carousel.Slide>
            <Card shadow="sm" padding="xs" radius="sm" withBorder h="100%" style={{ display: 'flex', alignItems: 'center' }}>
              <Group gap="xs" align="center" wrap="nowrap" w="100%">
                <ThemeIcon size="sm" color="violet" variant="light">
                  <IconStar size={14} />
                </ThemeIcon>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" c="dimmed" mb={1} truncate>Achievements</Text>
                  <Group gap="xs" align="baseline" wrap="nowrap">
                    <Text size="md" fw={700}>{stats.achievements}</Text>
                    <Text size="xs" c="dimmed">unlocked</Text>
                  </Group>
                </div>
              </Group>
            </Card>
          </Carousel.Slide>

          {/* Analytics Metrics Slides */}
          {analyticsData.timeMetrics.map((metric: any, index: number) => {
            const iconMap: Record<string, any> = {
              'IconClock': IconClock,
              'IconTrendingUp': IconTrendingUp,
              'IconTargetArrow': IconTargetArrow,
              'IconFolderOpen': IconFolderOpen
            };
            const IconComponent = iconMap[metric.icon] || IconClock;
            
            const TrendIcon = metric.trend === 'up' ? IconArrowUpRight : 
                             metric.trend === 'down' ? IconArrowDownRight : null;
            
            return (
              <Carousel.Slide key={`metric-${index}`}>
                <Card shadow="sm" padding="xs" radius="sm" withBorder h="100%" style={{ display: 'flex', alignItems: 'center' }}>
                  <Group gap="xs" align="center" wrap="nowrap" w="100%">
                    <ThemeIcon size="sm" color="blue" variant="light">
                      <IconComponent size={14} />
                    </ThemeIcon>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="xs" c="dimmed" mb={1} tt="uppercase" truncate>{metric.label}</Text>
                      <Group gap="xs" align="baseline" wrap="nowrap">
                        <Text size="md" fw={700}>{metric.value}</Text>
                        <Text size="xs" c="dimmed">{metric.unit}</Text>
                        {TrendIcon && metric.change > 0 && (
                          <Group gap={2} align="center">
                            <TrendIcon size={10} color={metric.trend === 'up' ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-red-6)'} />
                            <Text size="xs" c={metric.trend === 'up' ? 'teal' : 'red'} fw={600}>
                              {metric.change}%
                            </Text>
                          </Group>
                        )}
                      </Group>
                    </div>
                  </Group>
                </Card>
              </Carousel.Slide>
            );
          })}
        </Carousel>
      </Box>

      {/* Task Calendar - Full Width */}
      <Box style={{ width: '100%' }}>
        <TaskCalendar 
          tasks={userTasks}
          currentUser={authUser as any}
          onTaskClick={(task) => {}}
          onTaskUpdate={(task) => {
            // Reload dashboard data when tasks are updated
            loadDashboardData();
          }}
        />
      </Box>



      {/* Status Flow - StatsSegments Pattern */}
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={500}>Task Status Flow</Text>
          <Group gap="xs">
            <Text size="sm" c="dimmed">Total:</Text>
            <Text size="sm" fw={700}>{stats.tasksCompleted + stats.tasksPending}</Text>
          </Group>
        </Group>
        
        <Progress.Root size="xl" mb="md">
          {analyticsData.statusFlow.map((status: any, index: number) => (
            <Progress.Section
              key={index}
              value={status.percentage}
              color={
                status.name.includes('Done') ? 'green' :
                status.name.includes('Progress') ? 'blue' :
                status.name.includes('Review') ? 'yellow' :
                status.name.includes('Todo') ? 'gray' : 'violet'
              }
            >
              {status.percentage > 10 && (
                <Progress.Label>{status.percentage}%</Progress.Label>
              )}
            </Progress.Section>
          ))}
        </Progress.Root>
        
        <SimpleGrid cols={{ base: 2, sm: analyticsData.statusFlow.length }} spacing="xs">
          {analyticsData.statusFlow.map((status: any, index: number) => (
            <Group key={index} gap="xs" justify="center">
              <ThemeIcon
                size="xs"
                color={
                  status.name.includes('Done') ? 'green' :
                  status.name.includes('Progress') ? 'blue' :
                  status.name.includes('Review') ? 'yellow' :
                  status.name.includes('Todo') ? 'gray' : 'violet'
                }
              />
              <div>
                <Text size="xs" fw={500}>{status.name}</Text>
                <Text size="xs" c="dimmed">{status.value} tasks</Text>
              </div>
            </Group>
          ))}
        </SimpleGrid>
      </Card>

      {/* Charts Section */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Priority Distribution</Text>
              <Badge color="orange" variant="light" size="sm">Active</Badge>
            </Group>
            {analyticsData.priorityDistribution.length > 0 ? (
              <PieChart
                h={180}
                data={analyticsData.priorityDistribution}
                withTooltip
                tooltipDataSource="segment"
                mx="auto"
              />
            ) : (
              <Center h={180}>
                <Text size="sm" c="dimmed">No priority data</Text>
              </Center>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Category Breakdown</Text>
              <Badge color="violet" variant="light" size="sm">All time</Badge>
            </Group>
            {analyticsData.categoryBreakdown.length > 0 ? (
              <DonutChart
                h={180}
                data={analyticsData.categoryBreakdown}
                withTooltip
                tooltipDataSource="segment"
                mx="auto"
              />
            ) : (
              <Center h={180}>
                <Text size="sm" c="dimmed">No category data</Text>
              </Center>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={500}>Weekly Activity</Text>
              <Badge color="blue" variant="light" size="sm">Assigned vs Completed</Badge>
            </Group>
            <AreaChart
              h={180}
              data={weeklyData}
              dataKey="day"
              series={[
                { name: 'assigned', color: 'blue.6', label: 'Tasks Assigned' },
                { name: 'completed', color: 'green.6', label: 'Tasks Completed' }
              ]}
              curveType="natural"
              gridAxis="xy"
              tickLine="xy"
              withXAxis={false}
              withLegend
              legendProps={{ verticalAlign: 'bottom', height: 36 }}
            />
          </Card>
        </Grid.Col>
      </Grid>

      {/* Quick Actions & Recent Activity */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Text fw={500} mb="md">Quick Actions</Text>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
              <Button 
                variant="light" 
                leftSection={<IconCheckbox size={16} />}
                size="sm"
                onClick={() => onQuickAction?.('new-task')}
              >
                New Task
              </Button>
              <Button 
                variant="light" 
                leftSection={<IconTrophy size={16} />}
                size="sm"
                color="yellow"
                onClick={() => onQuickAction?.('goals')}
              >
                Set Goal
              </Button>
              <Button 
                variant="light" 
                leftSection={<IconUsers size={16} />}
                size="sm"
                color="green"
                onClick={() => onQuickAction?.('family')}
              >
                Family
              </Button>
              <Button 
                variant="light" 
                leftSection={<IconStar size={16} />}
                size="sm"
                color="violet"
                onClick={() => onQuickAction?.('achievements')}
              >
                Achievements
              </Button>
            </SimpleGrid>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Text fw={500} mb="md">Recent Activity</Text>
            <Stack gap="xs">
              {recentActivity.slice(0, 3).map((activity) => (
                <Group key={activity.id} gap="xs">
                  <ThemeIcon
                    size={16}
                    radius="xl"
                    color={
                      activity.type === 'task_completed' ? 'green' :
                      activity.type === 'points_earned' ? 'blue' :
                      activity.type === 'achievement_unlocked' ? 'yellow' :
                      'violet'
                    }
                  />
                  <div style={{ flex: 1 }}>
                    <Text size="xs" lineClamp={1}>{activity.title}</Text>
                    <Text size="xs" c="dimmed">{formatTimestamp(activity.timestamp)}</Text>
                  </div>
                </Group>
              ))}
              {recentActivity.length === 0 && (
                <Text size="xs" c="dimmed" ta="center" py="md">No recent activity</Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Task List Modal */}
      <Modal
        opened={taskModalOpened}
        onClose={() => setTaskModalOpened(false)}
        title={modalTitle}
        size="lg"
      >
        <ScrollArea h={400}>
          <Stack gap="sm">
            {modalTasks.length === 0 ? (
              <Text c="dimmed" ta="center" py="xl">No tasks found</Text>
            ) : (
              modalTasks.map((task) => {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const dueDate = task.due_date ? new Date(task.due_date) : null;
                let isOverdue = false;
                let daysDiff = null;
                let overdueText = '';
                
                if (dueDate) {
                  // For day-based calculation (metrics)
                  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                  const diffTime = dueDateOnly.getTime() - today.getTime();
                  daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  isOverdue = daysDiff < 0;
                  
                  // For granular overdue display (includes time)
                  if (dueDate < now) {
                    const timeDiff = now.getTime() - dueDate.getTime();
                    const minutesDiff = Math.floor(timeDiff / (1000 * 60));
                    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
                    const daysDiffExact = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                    
                    if (daysDiffExact >= 1) {
                      overdueText = `Overdue by ${daysDiffExact} day${daysDiffExact !== 1 ? 's' : ''}`;
                    } else if (hoursDiff >= 1) {
                      overdueText = `Overdue by ${hoursDiff} hour${hoursDiff !== 1 ? 's' : ''}`;
                    } else {
                      overdueText = `Overdue by ${minutesDiff} minute${minutesDiff !== 1 ? 's' : ''}`;
                    }
                  }
                }
                
                return (
                  <Card 
                    key={task.id} 
                    withBorder 
                    padding="sm" 
                    radius="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleTaskItemClick(task.id)}
                  >
                    <Group justify="space-between" align="flex-start">
                      <Stack gap="xs" style={{ flex: 1 }}>
                        <Group gap="sm">
                          <Badge
                            size="sm"
                            color={
                              task.priority === 'urgent' ? 'red' :
                              task.priority === 'high' ? 'orange' :
                              task.priority === 'medium' ? 'yellow' : 'green'
                            }
                            variant="filled"
                          >
                            {task.priority?.toUpperCase()}
                          </Badge>
                          <Badge
                            size="sm"
                            color={
                              task.status === 'done' ? 'green' :
                              task.status === 'in_progress' ? 'blue' :
                              task.status === 'review' ? 'yellow' : 'gray'
                            }
                            variant="light"
                          >
                            {task.status?.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </Group>
                        
                        <Text size="sm" fw={500}>{task.title}</Text>
                        
                        {task.description && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {task.description}
                          </Text>
                        )}

                        {dueDate && (
                          <Stack gap="xs">
                            <Group gap="xs">
                              <IconCalendar size={12} />
                              <Text size="xs" fw={500}>
                                Due: {dueDate.toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </Text>
                            </Group>
                            <Group gap="xs">
                              <IconClock size={12} />
                              <Text 
                                size="xs" 
                                c={isOverdue ? 'red' : daysDiff !== null && daysDiff <= 1 ? 'orange' : 'dimmed'}
                              >
                                {isOverdue 
                                  ? overdueText
                                  : daysDiff === 0 
                                    ? 'Due today'
                                    : `Due in ${daysDiff} day${daysDiff !== 1 ? 's' : ''}`
                                }
                              </Text>
                            </Group>
                          </Stack>
                        )}
                      </Stack>
                      
                      {task.points && (
                        <Badge variant="outline" size="sm">
                          {task.points}pt
                        </Badge>
                      )}
                    </Group>
                  </Card>
                );
              })
            )}
          </Stack>
        </ScrollArea>
      </Modal>

      {/* Task Drawer */}
      <TaskDrawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        taskId={selectedTaskId}
        currentUser={authUser as any}
        mode="view"
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
      />
    </Stack>
  );
};
