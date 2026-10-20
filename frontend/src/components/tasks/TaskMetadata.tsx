/**
 * @fileoverview TaskMetadata Component
 * @description Task metadata display component based on Mantine UI StatsSegments pattern
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Group, Text, Avatar } from '@mantine/core';
import { IconCalendar, IconUser, IconClock, IconAlertTriangle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Task } from '../../types/task';
import { User } from '../../types/user';
import { userService } from '../../services';
import classes from './TaskMetadata.module.css';

interface TaskMetadataProps {
  task: Task;
}

export function TaskMetadata({ task }: TaskMetadataProps) {
  const [createdByUser, setCreatedByUser] = useState<User | null>(task.created_by ?? null);
  const [userLoading, setUserLoading] = useState(false);


  // Fetch user details if not already populated
  useEffect(() => {
    const fetchUser = async () => {
      
      if (!task.created_by && task.created_by_id && !userLoading && !createdByUser) {
        try {
          setUserLoading(true);
          const userResponse = await userService.getUser(task.created_by_id);
          // API returns user directly, not wrapped in userResponse.user
          const user = userResponse.user || userResponse;
          setCreatedByUser(user);
        } catch (error) {
          console.error('❌ Failed to fetch user for TaskMetadata:', error);
          // Keep createdByUser as null to show fallback
        } finally {
          setUserLoading(false);
        }
      }
    };

    fetchUser();
  }, [task.created_by, task.created_by_id]);
  // Calculate days remaining or overdue (fixed logic matching TaskDrawer)
  const getDaysStatus = () => {
    if (!task.due_date) return null;
    
    const now = new Date();
    const due = new Date(task.due_date);
    
    // Set time to start of day for comparison (ignore time component for day calculation)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    const diffTime = dueDateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      // For granular overdue display (includes time)
      if (due < now) {
        const timeDiff = now.getTime() - due.getTime();
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));
        const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
        const daysDiffExact = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        let overdueValue = '';
        if (daysDiffExact >= 1) {
          overdueValue = `${daysDiffExact} day${daysDiffExact !== 1 ? 's' : ''}`;
        } else if (hoursDiff >= 1) {
          overdueValue = `${hoursDiff} hour${hoursDiff !== 1 ? 's' : ''}`;
        } else {
          overdueValue = `${minutesDiff} minute${minutesDiff !== 1 ? 's' : ''}`;
        }
        
        return {
          label: 'Overdue',
          value: overdueValue,
          color: 'red',
          icon: IconAlertTriangle
        };
      }
    } else if (diffDays === 0) {
      return {
        label: 'Due Today',
        value: 'Today',
        color: 'orange',
        icon: IconAlertTriangle
      };
    } else {
      return {
        label: 'Days Remaining',
        value: `${diffDays} day${diffDays !== 1 ? 's' : ''}`,
        color: diffDays <= 3 ? 'orange' : 'blue',
        icon: IconClock
      };
    }
  };

  const daysStatus = getDaysStatus();
  

  const metadata = [
    {
      label: 'Created By',
      value: createdByUser?.full_name || createdByUser?.username || (userLoading ? 'Loading...' : `User ${task.created_by_id}`),
      color: 'blue',
      icon: IconUser,
      showAvatar: !!createdByUser
    },
    {
      label: 'Created Date',
      value: dayjs(task.created_at).format('MMM DD, YYYY'),
      color: 'gray',
      icon: IconCalendar,
      showAvatar: undefined as boolean | undefined
    },
    ...(task.due_date ? [{
      label: 'Due Date',
      value: dayjs(task.due_date).format('MMM DD, YYYY'),
      color: 'purple',
      icon: IconCalendar,
      showAvatar: undefined as boolean | undefined
    }] : []),
    ...(daysStatus ? [{
      ...daysStatus,
      showAvatar: undefined as boolean | undefined
    }] : [])
  ];

  return (
    <Box className={classes.container}>
      <Group gap="md" wrap="nowrap" justify="space-between">
        {metadata.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Box 
              key={stat.label} 
              className={classes.stat}
              style={{ 
                borderBottomColor: `var(--mantine-color-${stat.color}-5)`,
                flex: 1,
                minWidth: 0
              }}
            >
              <Group gap="xs" mb={4}>
                <IconComponent size={14} color={`var(--mantine-color-${stat.color}-6)`} />
                <Text tt="uppercase" fz="xs" c="dimmed" fw={700} truncate>
                  {stat.label}
                </Text>
              </Group>

              <Group justify="space-between" align="flex-end" gap="xs">
                <Group gap="xs" style={{ minWidth: 0 }}>
                  {stat.showAvatar && createdByUser && (
                    <Avatar 
                      size="xs" 
                      name={createdByUser.full_name || createdByUser.username}
                      color="blue"
                      src={createdByUser.avatar_url}
                    />
                  )}
                  <Text fw={500} size="sm" truncate>
                    {stat.value}
                  </Text>
                </Group>
                {daysStatus && stat.label.includes('Day') && (
                  <Text 
                    c={stat.color} 
                    fw={700} 
                    size="xs" 
                    className={classes.statHighlight}
                  >
                    {stat.color === 'red' ? '!' : stat.color === 'orange' ? '⚠' : '✓'}
                  </Text>
                )}
              </Group>
            </Box>
          );
        })}
      </Group>
    </Box>
  );
}