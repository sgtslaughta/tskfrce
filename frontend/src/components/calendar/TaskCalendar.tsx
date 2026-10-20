import React, { useState, useMemo } from 'react';
import {
  Card,
  Group,
  ActionIcon,
  Text,
  Stack,
  Badge,
  HoverCard,
  Modal,
  Box,
  ScrollArea,
  useMantineTheme
} from '@mantine/core';
import classes from './TaskCalendar.module.css';
import { Calendar } from '@mantine/dates';
import { 
  IconChevronLeft, 
  IconChevronRight,
  IconCalendar,
  IconClock,
  IconUser,
  IconFlag
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Task, TaskStatus, TaskPriority } from '../../services/taskService';
import { TaskDrawer } from '../tasks/TaskDrawer';
import { TaskCreateRequest, TaskUpdateRequest } from '../../types/task';
import { User } from '../../types/user';
import { taskService } from '../../services';
import { notifications } from '@mantine/notifications';

interface TaskCalendarProps {
  tasks: Task[];
  currentUser?: User;
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (task: Task) => void;
  className?: string;
}

interface TaskEvent {
  task: Task;
  date: string;
  isStart: boolean;
  isEnd: boolean;
  isMiddle: boolean;
  spanDays: number;
  dayIndex?: number; // Position within the span
  weekRow?: number; // Which week row this event is on
  startCol?: number; // Starting column (0-6)
  endCol?: number; // Ending column (0-6)
}

const TaskCalendar: React.FC<TaskCalendarProps> = ({ tasks, currentUser, onTaskClick, onTaskUpdate, className }) => {
  const [currentDate, setCurrentDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'create' | 'edit'>('view');
  const [dayModalOpened, setDayModalOpened] = useState(false);
  const [selectedDayTasks, setSelectedDayTasks] = useState<TaskEvent[]>([]);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const theme = useMantineTheme();

  // Process tasks into calendar events
  const taskEvents = useMemo(() => {
    const events: TaskEvent[] = [];
    
    // Get current month's start and end for filtering
    const monthStart = dayjs(currentDate).startOf('month').subtract(7, 'days'); // Include previous week for spanning tasks
    const monthEnd = dayjs(currentDate).endOf('month').add(7, 'days'); // Include next week for spanning tasks
    
    tasks.forEach(task => {
      const startDate = task.created_at ? dayjs(task.created_at).startOf('day') : dayjs().startOf('day');
      const endDate = task.due_date ? dayjs(task.due_date).startOf('day') : startDate;
      
      // Skip tasks that don't overlap with the visible month range
      if (endDate.valueOf() < monthStart.valueOf() || startDate.valueOf() > monthEnd.valueOf()) {
        return;
      }
      
      // If same day, just add one event
      if (startDate.format('YYYY-MM-DD') === endDate.format('YYYY-MM-DD')) {
        events.push({
          task,
          date: startDate.format('YYYY-MM-DD'),
          isStart: true,
          isEnd: true,
          isMiddle: false,
          spanDays: 1
        });
      } else {
        // Multi-day task - add events for each day
        let current = startDate;
        const totalDays = endDate.diff(startDate, 'day') + 1;
        
        while (current.valueOf() <= endDate.valueOf()) {
          // Only add events for days within our visible range
          if (current.valueOf() >= monthStart.valueOf() && current.valueOf() <= monthEnd.valueOf()) {
            events.push({
              task,
              date: current.format('YYYY-MM-DD'),
              isStart: current.format('YYYY-MM-DD') === startDate.format('YYYY-MM-DD'),
              isEnd: current.format('YYYY-MM-DD') === endDate.format('YYYY-MM-DD'),
              isMiddle: current.format('YYYY-MM-DD') !== startDate.format('YYYY-MM-DD') && current.format('YYYY-MM-DD') !== endDate.format('YYYY-MM-DD'),
              spanDays: totalDays
            });
          }
          current = current.add(1, 'day');
        }
      }
    });
    
    return events;
  }, [tasks, currentDate]);

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    return taskEvents.filter(event => event.date === dateStr);
  };

  // Get priority color
  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.URGENT: return 'red';
      case TaskPriority.HIGH: return 'orange';
      case TaskPriority.MEDIUM: return 'yellow';
      case TaskPriority.LOW: return 'green';
      default: return 'gray';
    }
  };

  // Get random consistent color based on task ID for better visual distinction
  const getTaskColor = (taskId: number) => {
    const colors = [
      'blue', 'grape', 'violet', 'indigo', 'cyan', 'teal', 'green', 
      'lime', 'yellow', 'orange', 'red', 'pink', 'gray', 'dark'
    ];
    
    // Use task ID to generate consistent but seemingly random color
    const colorIndex = taskId % colors.length;
    return colors[colorIndex];
  };

  // Get status color
  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.DONE: return 'green';
      case TaskStatus.IN_PROGRESS: return 'blue';
      case TaskStatus.REVIEW: return 'yellow';
      case TaskStatus.TODO: return 'gray';
      case TaskStatus.CANCELLED: return 'red';
      default: return 'gray';
    }
  };

  // Handle task click
  const handleTaskClick = (taskEvent: TaskEvent) => {
    setSelectedTaskId(taskEvent.task.id);
    setDrawerMode('view');
    setDrawerOpened(true);
    setError('');
    onTaskClick?.(taskEvent.task);
  };

  // Handle day click (for all tasks)
  const handleDayClick = (date: Date, dayTasks: TaskEvent[]) => {
    if (dayTasks.length > 0) {
      setSelectedDayTasks(dayTasks);
      setSelectedDayDate(date);
      setDayModalOpened(true);
    }
  };

  // Handle task save
  const handleTaskSave = async (taskData: TaskCreateRequest | TaskUpdateRequest) => {
    try {
      setLoading(true);
      setError('');
      let savedTask;

      if (drawerMode === 'create') {
        // Create new task
        const createData = {
          ...taskData,
          status: taskData.status as any
        };
        savedTask = await taskService.createTask(createData as any);
        notifications.show({
          title: 'Success',
          message: 'Task created successfully!',
          color: 'green'
        });
      } else if (selectedTaskId) {
        // If we have a selectedTaskId, it's an update (regardless of drawerMode)
        // Update existing task
        const updateData = {
          ...taskData,
          status: taskData.status as any
        };
        savedTask = await taskService.updateTask(selectedTaskId!, updateData as any);
        notifications.show({
          title: 'Success',
          message: 'Task updated successfully!',
          color: 'green'
        });
      }

      // Trigger cache invalidation by calling onTaskUpdate with the saved task
      if (savedTask) {
        onTaskUpdate?.(savedTask);
      }

      setDrawerOpened(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      notifications.show({
        title: 'Error',
        message: 'Failed to save task. Please try again.',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle task delete
  const handleTaskDelete = async (taskId: number) => {
    try {
      setLoading(true);
      await taskService.deleteTask(taskId);
      notifications.show({
        title: 'Success',
        message: 'Task deleted successfully!',
        color: 'green'
      });
      setDrawerOpened(false);
      // For deletion, we just need to trigger a refresh without fetching the deleted task
      // The parent component should refresh its task list
      if (selectedTaskId) {
        // Create a dummy task object to trigger the refresh
        const deletedTask = { id: selectedTaskId } as Task;
        onTaskUpdate?.(deletedTask);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      notifications.show({
        title: 'Error',
        message: 'Failed to delete task. Please try again.',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle drawer close
  const handleDrawerClose = () => {
    setDrawerOpened(false);
    setSelectedTaskId(null);
    setError('');
    
    // Trigger a refresh to get any task updates that happened during the drawer session
    // We create a dummy task with the selected task ID to trigger onTaskUpdate
    if (selectedTaskId && onTaskUpdate) {
      // Fetch the updated task to trigger parent refresh
      taskService.getTask(selectedTaskId)
        .then((updatedTask) => {
          onTaskUpdate(updatedTask);
        })
        .catch((err) => {
          console.warn('Failed to refresh task after drawer close:', err);
          // Even if fetch fails, we can trigger a refresh with a minimal task object
          // The parent component should handle this appropriately
          onTaskUpdate({ id: selectedTaskId } as Task);
        });
    }
  };

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = dayjs(currentDate).add(direction === 'next' ? 1 : -1, 'month').format('YYYY-MM-DD');
    setCurrentDate(newDate);
  };

  // Calculate maximum tasks that can fit without overlapping
  const calculateMaxTasksPerDay = () => {
    // Calendar day height is 80px
    // Date text takes ~20px
    // Each task badge is ~16px (xs size) + 2px gap
    // Need some padding at bottom
    const dayHeight = 80;
    const dateHeight = 20;
    const taskHeight = 16;
    const taskGap = 2;
    const bottomPadding = 8;
    
    const availableHeight = dayHeight - dateHeight - bottomPadding;
    return Math.floor(availableHeight / (taskHeight + taskGap));
  };

  const maxTasksPerDay = calculateMaxTasksPerDay(); // Should be around 3

  // Custom day renderer
  const renderDay = (date: string) => {
    const dateObj = dayjs(date).toDate();
    const dayTasks = getTasksForDate(dateObj);
    const isToday = dayjs(date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
    
    // Sort tasks: incomplete tasks first, then completed tasks at the bottom
    const sortedDayTasks = dayTasks.sort((a, b) => {
      const aCompleted = a.task.status === TaskStatus.DONE;
      const bCompleted = b.task.status === TaskStatus.DONE;
      
      // If completion status is different, show incomplete first
      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }
      
      // If both have same completion status, maintain original order
      return 0;
    });
    
    const tasksToShow = sortedDayTasks.slice(0, maxTasksPerDay);
    const hasMoreTasks = sortedDayTasks.length > maxTasksPerDay;
    
    return (
      <Box 
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: '100%', 
          minHeight: '80px',
          cursor: dayTasks.length > 0 ? 'pointer' : 'default'
        }}
        onClick={(e) => {
          if (dayTasks.length > 0) {
            e.stopPropagation();
            handleDayClick(dateObj, dayTasks);
          }
        }}
      >
        <Text 
          size="sm" 
          fw={isToday ? 700 : 400}
          c={isToday ? 'blue' : 'inherit'}
          mb="xs"
        >
          {dayjs(date).date()}
        </Text>
        
        <div className={classes.taskContainer}>
          {tasksToShow.map((taskEvent, index) => {
            const task = taskEvent.task;
            const taskColor = getTaskColor(task.id);
            const statusColor = getStatusColor(task.status);
            const isCompleted = task.status === TaskStatus.DONE;
            
            return (
              <HoverCard key={`${task.id}-${index}`} width={320} shadow="md" openDelay={200} closeDelay={100}>
                <HoverCard.Target>
                  <Badge
                    size="xs"
                    color={taskColor}
                    variant="filled"
                    className={`${classes.taskBadge} ${
                      isCompleted ? classes.taskBadgeCompleted : ''
                    } ${
                      taskEvent.spanDays > 1 ? classes.taskBadgeSpanning : ''
                    }`}
                    style={{
                      borderRadius: taskEvent.isStart && taskEvent.isEnd ? '4px' : 
                                 taskEvent.isStart ? '4px 0 0 4px' :
                                 taskEvent.isEnd ? '0 4px 4px 0' : '0px',
                      zIndex: 10,
                      opacity: taskEvent.isMiddle ? 0.8 : 1,
                      '--show-left-connection': !taskEvent.isStart && taskEvent.spanDays > 1 ? 'block' : 'none',
                      '--show-right-connection': !taskEvent.isEnd && taskEvent.spanDays > 1 ? 'block' : 'none'
                    } as React.CSSProperties}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTaskClick(taskEvent);
                    }}
                  >
                    {taskEvent.isStart || taskEvent.spanDays === 1 ? 
                      task.title.substring(0, 12) + (task.title.length > 12 ? '...' : '') : 
                      '···'
                    }
                  </Badge>
                </HoverCard.Target>
                <HoverCard.Dropdown>
                  <Stack gap="xs">
                    <Text fw={500} size="sm">{task.title}</Text>
                    <Group gap="xs">
                      <Badge size="xs" color={getPriorityColor(task.priority)} variant="outline">
                        {task.priority}
                      </Badge>
                      <Badge size="xs" color={statusColor} variant="light">
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </Group>
                    
                    {taskEvent.spanDays > 1 && (
                      <Text size="xs" c="dimmed">
                        📅 Spans {taskEvent.spanDays} days
                        {taskEvent.isStart && ' (starts today)'}
                        {taskEvent.isEnd && ' (ends today)'}
                        {taskEvent.isMiddle && ` (day ${dayjs(date).diff(dayjs(task.created_at), 'day') + 1} of ${taskEvent.spanDays})`}
                      </Text>
                    )}
                    
                    {task.description && (
                      <Text size="xs" c="dimmed" lineClamp={3}>
                        {task.description}
                      </Text>
                    )}
                    
                    <Group gap="md" mt="xs">
                      {task.due_date && (
                        <Group gap="xs">
                          <IconClock size={12} />
                          <Text size="xs" c="dimmed">
                            Due {dayjs(task.due_date).format('MMM DD')}
                          </Text>
                        </Group>
                      )}
                      
                      {task.points && (
                        <Badge variant="outline" size="xs">
                          {task.points}pt
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </HoverCard.Dropdown>
              </HoverCard>
            );
          })}
          
          {hasMoreTasks && (
            <div 
              className={classes.moreText}
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={(e) => {
                e.stopPropagation();
                handleDayClick(dateObj, dayTasks);
              }}
            >
              +{dayTasks.length - maxTasksPerDay} more
            </div>
          )}
        </div>
      </Box>
    );
  };

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder className={className} style={{ width: '100%' }}>
      {/* Calendar Header */}
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <IconCalendar size={20} color={theme.colors.blue[6]} />
          <Text fw={500} size="lg">Task Calendar</Text>
        </Group>
        
        <Group gap="xs">
          <ActionIcon 
            variant="subtle" 
            onClick={() => navigateMonth('prev')}
            aria-label="Previous month"
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
          
          <Text fw={500} size="md" style={{ minWidth: '120px', textAlign: 'center' }}>
            {dayjs(currentDate).format('MMMM YYYY')}
          </Text>
          
          <ActionIcon 
            variant="subtle" 
            onClick={() => navigateMonth('next')}
            aria-label="Next month"
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Calendar */}
      <Box className={classes.calendarContainer}>
        <Calendar
          key={`calendar-${dayjs(currentDate).format('YYYY-MM')}`} // Force re-render on month change
          date={currentDate} // Control the displayed month
          onDateChange={(date: string) => setCurrentDate(date)}
          size="lg"
          renderDay={renderDay}
          classNames={{}}
          styles={{
            month: {
              width: '100%',
              overflow: 'visible'
            },
            monthThead: {
              width: '100%'
            },
            monthRow: {
              width: '100%',
              overflow: 'visible'
            },
            monthTbody: {
              width: '100%',
              overflow: 'visible'
            },
            day: {
              height: '80px',
              padding: '4px',
              minWidth: '120px',
              width: '14.28%',
              overflow: 'visible',
              position: 'relative'
            },
            calendarHeader: {
              display: 'none'
            }
          }}
        />
      </Box>


      {/* Day Tasks Modal */}
      <Modal
        opened={dayModalOpened}
        onClose={() => setDayModalOpened(false)}
        title={
          selectedDayDate ? (
            <Group gap="sm">
              <IconCalendar size={16} />
              <Text fw={500}>
                {dayjs(selectedDayDate).format('MMMM DD, YYYY')} - {selectedDayTasks.length} task{selectedDayTasks.length !== 1 ? 's' : ''}
              </Text>
            </Group>
          ) : (
            'Day Tasks'
          )
        }
        size="md"
      >
        <ScrollArea h={400}>
          <Stack gap="sm">
            {selectedDayTasks.map((taskEvent, index) => {
              const task = taskEvent.task;
              const taskColor = getTaskColor(task.id);
              const statusColor = getStatusColor(task.status);
              const isCompleted = task.status === TaskStatus.DONE;

              return (
                <Card 
                  key={`${task.id}-${index}`} 
                  withBorder 
                  padding="sm" 
                  radius="sm"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setDayModalOpened(false);
                    handleTaskClick(taskEvent);
                  }}
                >
                  <Group justify="space-between" align="flex-start">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group gap="sm">
                        <Badge
                          size="sm"
                          color={taskColor}
                          variant="filled"
                          style={{
                            opacity: isCompleted ? 0.6 : 1,
                            minWidth: '12px',
                            height: '12px',
                            padding: '0',
                            borderRadius: '50%'
                          }}
                          title={`Task color: ${taskColor}`}
                        />
                        <Badge
                          size="sm"
                          color={getPriorityColor(task.priority)}
                          variant="filled"
                          style={{
                            opacity: isCompleted ? 0.6 : 1,
                            textDecoration: isCompleted ? 'line-through' : 'none'
                          }}
                        >
                          {task.priority.toUpperCase()}
                        </Badge>
                        <Badge
                          size="sm"
                          color={statusColor}
                          variant="light"
                        >
                          {task.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </Group>
                      
                      <Text 
                        size="sm" 
                        fw={500}
                        style={{
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          opacity: isCompleted ? 0.7 : 1
                        }}
                      >
                        {task.title}
                      </Text>
                      
                      {task.description && (
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {task.description}
                        </Text>
                      )}

                      <Group gap="md">
                        {taskEvent.spanDays > 1 && (
                          <Group gap="xs">
                            <IconCalendar size={12} />
                            <Text size="xs" c="dimmed">
                              {taskEvent.isStart && 'Starts today'}
                              {taskEvent.isEnd && 'Ends today'}
                              {taskEvent.isMiddle && `Day ${dayjs(selectedDayDate).diff(dayjs(task.created_at), 'day') + 1} of ${taskEvent.spanDays}`}
                            </Text>
                          </Group>
                        )}
                        
                        {task.due_date && (
                          <Group gap="xs">
                            <IconClock size={12} />
                            <Text size="xs" c="dimmed">
                              Due {dayjs(task.due_date).format('MMM DD')}
                            </Text>
                          </Group>
                        )}
                      </Group>
                    </Stack>
                    
                    {task.points && (
                      <Badge variant="outline" size="sm">
                        {task.points}pt
                      </Badge>
                    )}
                  </Group>
                </Card>
              );
            })}
          </Stack>
        </ScrollArea>
      </Modal>

      {/* Task Drawer */}
      <TaskDrawer
        opened={drawerOpened}
        onClose={handleDrawerClose}
        taskId={selectedTaskId}
        currentUser={currentUser}
        mode={drawerMode}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
        loading={loading}
        error={error}
      />
    </Card>
  );
};

export default TaskCalendar;