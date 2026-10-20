/**
 * @fileoverview Task Warning Modal Component
 * @description Modal that shows upcoming and overdue tasks after login
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  Badge,
  ScrollArea,
  Checkbox,
  Alert,
  ThemeIcon,
  Divider,
  Box,
  Title,
  Card,
  Grid,
  ActionIcon,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconClock,
  IconCalendar,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconExclamationMark,
  IconUser,
  IconFlag,
} from '@tabler/icons-react';
import { Task, TaskStatus, TaskPriority } from '../../services/taskService';
import { saveUserSettings, getUserSettings } from '../../utils/cookies';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * @description Props for TaskWarningModal component
 */
interface TaskWarningModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** User ID to filter tasks */
  userId: string;
}

/**
 * @description Task warning data interface
 */
interface TaskWarningData {
  createdTasks: {
    overdue: Task[];
    upcoming: Task[];
  };
  assignedTasks: {
    overdue: Task[];
    upcoming: Task[];
  };
  totalCount: number;
}

/**
 * @description TaskWarningModal component
 * Shows upcoming and overdue tasks after login with option to disable future warnings
 */
export const TaskWarningModal: React.FC<TaskWarningModalProps> = ({
  opened,
  onClose,
  userId,
}) => {
  const { isDarkMode } = useTheme();
  const mantineTheme = useMantineTheme();
  
  const [taskData, setTaskData] = useState<TaskWarningData>({
    createdTasks: {
      overdue: [],
      upcoming: [],
    },
    assignedTasks: {
      overdue: [],
      upcoming: [],
    },
    totalCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * @description Fetch tasks and categorize them by created/assigned and overdue/upcoming
   * Uses the same filtering approach as the calendar/dashboard
   */
  const fetchTaskWarnings = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Import taskService dynamically to avoid circular dependencies
      const { taskService } = await import('../../services/taskService');
      
      const userIdNum = parseInt(userId);
      
      // Get all tasks (same approach as calendar/dashboard)
      const taskResponse = await taskService.getTasks();
      const allTasks = taskResponse.tasks;
      
      // Filter to only tasks for current user (created by OR assigned to)
      const userTasks = allTasks.filter(task => 
        task.created_by_id === userIdNum || task.assigned_to_id === userIdNum
      );

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      // Helper function to categorize tasks by due date
      const categorizeTasks = (tasks: Task[]) => {
        const overdue: Task[] = [];
        const upcoming: Task[] = [];

        tasks.forEach((task) => {
          // Only include tasks that are not completed
          if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
            return;
          }

          if (task.due_date) {
            const dueDate = new Date(task.due_date);
            const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

            if (dueDateOnly < today) {
              overdue.push(task);
            } else if (dueDateOnly <= nextWeek) {
              upcoming.push(task);
            }
          }
        });

        // Sort by due date
        const sortByDueDate = (a: Task, b: Task) => {
          if (!a.due_date || !b.due_date) return 0;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        };

        return {
          overdue: overdue.sort(sortByDueDate),
          upcoming: upcoming.sort(sortByDueDate),
        };
      };

      // Separate tasks created by user from tasks assigned to user
      const createdByUser = userTasks.filter(task => 
        task.created_by_id === userIdNum && task.assigned_to_id !== userIdNum
      );
      
      const assignedToUser = userTasks.filter(task => 
        task.assigned_to_id === userIdNum
      );

      const createdTasks = categorizeTasks(createdByUser);
      const assignedTasks = categorizeTasks(assignedToUser);

      const totalCount = 
        createdTasks.overdue.length + 
        createdTasks.upcoming.length + 
        assignedTasks.overdue.length + 
        assignedTasks.upcoming.length;

      setTaskData({
        createdTasks,
        assignedTasks,
        totalCount,
      });
    } catch (err) {
      console.error('Failed to fetch task warnings:', err);
      setError('Failed to load task information. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * @description Handle modal close
   */
  const handleClose = () => {
    if (dontShowAgain) {
      // Save preference to not show task warnings again
      const currentSettings = getUserSettings();
      saveUserSettings({
        ...currentSettings,
        preferences: {
          ...currentSettings.preferences,
          showTaskWarnings: false,
        },
      });
    }
    onClose();
  };

  /**
   * @description Get priority color
   */
  const getPriorityColor = (priority: TaskPriority): string => {
    switch (priority) {
      case TaskPriority.URGENT:
        return 'red';
      case TaskPriority.HIGH:
        return 'orange';
      case TaskPriority.MEDIUM:
        return 'yellow';
      case TaskPriority.LOW:
        return 'green';
      default:
        return 'gray';
    }
  };

  /**
   * @description Get status color
   */
  const getStatusColor = (status: TaskStatus): string => {
    switch (status) {
      case TaskStatus.TODO:
        return 'blue';
      case TaskStatus.ASSIGNED:
        return 'cyan';
      case TaskStatus.IN_PROGRESS:
        return 'yellow';
      case TaskStatus.SUBMITTED_FOR_APPROVAL:
        return 'orange';
      case TaskStatus.REVIEW:
        return 'purple';
      default:
        return 'gray';
    }
  };

  /**
   * @description Format due date
   */
  const formatDueDate = (dueDate: string): string => {
    const date = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = dueDateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  /**
   * @description Fetch tasks when modal opens
   */
  useEffect(() => {
    if (opened && userId) {
      fetchTaskWarnings();
    }
  }, [opened, userId]);

  // Don't show modal if user has disabled task warnings
  useEffect(() => {
    const settings = getUserSettings();
    if (settings.preferences?.showTaskWarnings === false) {
      onClose();
    }
  }, [onClose]);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="sm">
          <ThemeIcon 
            color={isDarkMode ? "orange" : "orange.6"} 
            variant="light" 
            size="lg"
          >
            <IconAlertTriangle size={20} />
          </ThemeIcon>
          <Title order={3} c={isDarkMode ? "white" : "dark"}>
            Task Alerts
          </Title>
        </Group>
      }
      size="lg"
      centered
      closeOnClickOutside={false}
      closeOnEscape={true}
      styles={{
        content: {
          backgroundColor: isDarkMode ? mantineTheme.colors.dark[7] : mantineTheme.colors.gray[0],
          backdropFilter: 'none', // Disable backdrop filter for password manager compatibility
          filter: 'none', // Disable filters
        },
        header: {
          backgroundColor: isDarkMode ? mantineTheme.colors.dark[7] : mantineTheme.colors.gray[0],
          borderBottom: `1px solid ${isDarkMode ? mantineTheme.colors.dark[4] : mantineTheme.colors.gray[3]}`,
          backdropFilter: 'none',
          filter: 'none',
        },
        body: {
          backgroundColor: isDarkMode ? mantineTheme.colors.dark[7] : mantineTheme.colors.gray[0],
          backdropFilter: 'none',
          filter: 'none',
        },
      }}
    >
      <Stack gap="md">
        {loading ? (
          <Box ta="center" py="xl">
            <Text c="dimmed">Loading task information...</Text>
          </Box>
        ) : error ? (
          <Alert
            icon={<IconExclamationMark size={16} />}
            title="Error"
            color="red"
            variant="light"
          >
            {error}
          </Alert>
        ) : taskData.totalCount === 0 ? (
          <Alert
            icon={<IconCheck size={16} />}
            title="All caught up!"
            color="green"
            variant="light"
          >
            <Text size="sm">
              You have no overdue or upcoming tasks. Great job staying on top of things!
            </Text>
          </Alert>
        ) : (
          <>
            <Text size="sm" c="dimmed" mb="md">
              You have {taskData.totalCount} task{taskData.totalCount === 1 ? '' : 's'} that need your attention:
            </Text>

            <Box mx="sm" my="md">
              <ScrollArea.Autosize mah={450} p="md">
                <Grid gutter="md">
                {/* Left Column: Tasks Created by User */}
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="sm">
                    <Group gap="xs" mb="xs">
                      <IconUser size={16} />
                      <Text fw={600} size="sm" c={isDarkMode ? "white" : "dark"}>
                        Tasks I Created
                      </Text>
                    </Group>

                    {/* Created - Overdue */}
                    {taskData.createdTasks.overdue.length > 0 && (
                      <Box>
                        <Group gap="xs" mb="xs">
                          <ThemeIcon color={isDarkMode ? "red.4" : "red.6"} variant="light" size="xs">
                            <IconAlertTriangle size={12} />
                          </ThemeIcon>
                          <Text fw={500} size="xs" c={isDarkMode ? "red.2" : "red.7"}>
                            Overdue ({taskData.createdTasks.overdue.length})
                          </Text>
                        </Group>
                        <Stack gap="xs">
                          {taskData.createdTasks.overdue.map((task) => (
                            <Card 
                              key={`created-overdue-${task.id}`}
                              p="xs" 
                              withBorder
                              bg={isDarkMode ? mantineTheme.colors.dark[6] : mantineTheme.colors.red[0]}
                              style={{
                                borderColor: isDarkMode ? mantineTheme.colors.red[6] : mantineTheme.colors.red[3],
                              }}
                            >
                              <Text fw={500} size="xs" c={isDarkMode ? "white" : "dark"} lineClamp={1}>
                                {task.title}
                              </Text>
                              {((task as any).assigned_user || (task as any).assigned_to) && (
                                <Group gap="xs" mt="xs">
                                  <IconUser size={10} />
                                  <Text size="xs" c="dimmed" lineClamp={1}>
                                    Assigned to: {((task as any).assigned_user?.username || (task as any).assigned_to?.username) || 'Unknown'}
                                  </Text>
                                </Group>
                              )}
                              <Group gap="xs" mt="xs">
                                <Badge color={getPriorityColor(task.priority)} variant="light" size="xs">
                                  {task.priority}
                                </Badge>
                                <Text size="xs" c={isDarkMode ? "red.3" : "red.7"} fw={500}>
                                  {task.due_date && formatDueDate(task.due_date)}
                                </Text>
                              </Group>
                            </Card>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Created - Upcoming */}
                    {taskData.createdTasks.upcoming.length > 0 && (
                      <Box>
                        <Group gap="xs" mb="xs">
                          <ThemeIcon color={isDarkMode ? "yellow.4" : "yellow.6"} variant="light" size="xs">
                            <IconClock size={12} />
                          </ThemeIcon>
                          <Text fw={500} size="xs" c={isDarkMode ? "yellow.2" : "yellow.8"}>
                            Upcoming ({taskData.createdTasks.upcoming.length})
                          </Text>
                        </Group>
                        <Stack gap="xs">
                          {taskData.createdTasks.upcoming.map((task) => (
                            <Card 
                              key={`created-upcoming-${task.id}`}
                              p="xs" 
                              withBorder
                              bg={isDarkMode ? mantineTheme.colors.dark[6] : mantineTheme.colors.yellow[0]}
                              style={{
                                borderColor: isDarkMode ? mantineTheme.colors.yellow[6] : mantineTheme.colors.yellow[3],
                              }}
                            >
                              <Text fw={500} size="xs" c={isDarkMode ? "white" : "dark"} lineClamp={1}>
                                {task.title}
                              </Text>
                              {((task as any).assigned_user || (task as any).assigned_to) && (
                                <Group gap="xs" mt="xs">
                                  <IconUser size={10} />
                                  <Text size="xs" c="dimmed" lineClamp={1}>
                                    Assigned to: {((task as any).assigned_user?.username || (task as any).assigned_to?.username) || 'Unknown'}
                                  </Text>
                                </Group>
                              )}
                              <Group gap="xs" mt="xs">
                                <Badge color={getPriorityColor(task.priority)} variant="light" size="xs">
                                  {task.priority}
                                </Badge>
                                <Text size="xs" c={isDarkMode ? "yellow.3" : "yellow.8"} fw={500}>
                                  {task.due_date && formatDueDate(task.due_date)}
                                </Text>
                              </Group>
                            </Card>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {taskData.createdTasks.overdue.length === 0 && taskData.createdTasks.upcoming.length === 0 && (
                      <Text size="xs" c="dimmed" ta="center" py="md">
                        No tasks requiring attention
                      </Text>
                    )}
                  </Stack>
                </Grid.Col>

                {/* Right Column: Tasks Assigned to User */}
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Stack gap="sm">
                    <Group gap="xs" mb="xs">
                      <IconFlag size={16} />
                      <Text fw={600} size="sm" c={isDarkMode ? "white" : "dark"}>
                        Tasks Assigned to Me
                      </Text>
                    </Group>

                    {/* Assigned - Overdue */}
                    {taskData.assignedTasks.overdue.length > 0 && (
                      <Box>
                        <Group gap="xs" mb="xs">
                          <ThemeIcon color={isDarkMode ? "red.4" : "red.6"} variant="light" size="xs">
                            <IconAlertTriangle size={12} />
                          </ThemeIcon>
                          <Text fw={500} size="xs" c={isDarkMode ? "red.2" : "red.7"}>
                            Overdue ({taskData.assignedTasks.overdue.length})
                          </Text>
                        </Group>
                        <Stack gap="xs">
                          {taskData.assignedTasks.overdue.map((task) => (
                            <Card 
                              key={`assigned-overdue-${task.id}`}
                              p="xs" 
                              withBorder
                              bg={isDarkMode ? mantineTheme.colors.dark[6] : mantineTheme.colors.red[0]}
                              style={{
                                borderColor: isDarkMode ? mantineTheme.colors.red[6] : mantineTheme.colors.red[3],
                              }}
                            >
                              <Text fw={500} size="xs" c={isDarkMode ? "white" : "dark"} lineClamp={1}>
                                {task.title}
                              </Text>
                              <Group gap="xs" mt="xs">
                                <Badge color={getPriorityColor(task.priority)} variant="light" size="xs">
                                  {task.priority}
                                </Badge>
                                <Text size="xs" c={isDarkMode ? "red.3" : "red.7"} fw={500}>
                                  {task.due_date && formatDueDate(task.due_date)}
                                </Text>
                              </Group>
                            </Card>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Assigned - Upcoming */}
                    {taskData.assignedTasks.upcoming.length > 0 && (
                      <Box>
                        <Group gap="xs" mb="xs">
                          <ThemeIcon color={isDarkMode ? "yellow.4" : "yellow.6"} variant="light" size="xs">
                            <IconClock size={12} />
                          </ThemeIcon>
                          <Text fw={500} size="xs" c={isDarkMode ? "yellow.2" : "yellow.8"}>
                            Upcoming ({taskData.assignedTasks.upcoming.length})
                          </Text>
                        </Group>
                        <Stack gap="xs">
                          {taskData.assignedTasks.upcoming.map((task) => (
                            <Card 
                              key={`assigned-upcoming-${task.id}`}
                              p="xs" 
                              withBorder
                              bg={isDarkMode ? mantineTheme.colors.dark[6] : mantineTheme.colors.yellow[0]}
                              style={{
                                borderColor: isDarkMode ? mantineTheme.colors.yellow[6] : mantineTheme.colors.yellow[3],
                              }}
                            >
                              <Text fw={500} size="xs" c={isDarkMode ? "white" : "dark"} lineClamp={1}>
                                {task.title}
                              </Text>
                              <Group gap="xs" mt="xs">
                                <Badge color={getPriorityColor(task.priority)} variant="light" size="xs">
                                  {task.priority}
                                </Badge>
                                <Text size="xs" c={isDarkMode ? "yellow.3" : "yellow.8"} fw={500}>
                                  {task.due_date && formatDueDate(task.due_date)}
                                </Text>
                              </Group>
                            </Card>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {taskData.assignedTasks.overdue.length === 0 && taskData.assignedTasks.upcoming.length === 0 && (
                      <Text size="xs" c="dimmed" ta="center" py="md">
                        No tasks requiring attention
                      </Text>
                    )}
                  </Stack>
                </Grid.Col>
                </Grid>
              </ScrollArea.Autosize>
            </Box>

            <Divider mt="md" />

            <Group justify="space-between" wrap="wrap" gap="md" mt="md">
              <Checkbox
                label="Don't show this again"
                checked={dontShowAgain}
                onChange={(event) => setDontShowAgain(event.currentTarget.checked)}
                size="sm"
                c={isDarkMode ? "white" : "dark"}
              />
              <Group gap="sm" wrap="wrap">
                <Button
                  variant="light"
                  color="gray"
                  onClick={handleClose}
                  leftSection={<IconX size={16} />}
                  size="sm"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    // Navigate to tasks page
                    window.location.href = '/tasks';
                  }}
                  leftSection={<IconCalendar size={16} />}
                  size="sm"
                >
                  View All Tasks
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};
