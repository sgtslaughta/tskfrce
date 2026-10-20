/**
 * @fileoverview My Hub page component for TaaskMaaster
 * @description Central hub for individual users with tabbed interface for Dashboard, Lists & Tasks, and Stats & Progress
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { 
  Container,
  Title,
  Tabs,
  Text,
  Card,
  Group,
  Stack,
  Button,
  Grid,
  Badge,
  ThemeIcon,
  Paper
} from '@mantine/core';
import { 
  IconHome,
  IconChecklist,
  IconChartBar,
  IconTrophy,
  IconCalendar,
  IconStar
} from '@tabler/icons-react';
import { AppLayout } from '../layout/AppLayout';

// Import the original Dashboard content for the first tab
import { Dashboard as DashboardContent } from './Dashboard';

/**
 * @description Lists & Tasks tab placeholder component
 */
function ListsAndTasksTab() {
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Lists & Tasks</Title>
        <Button leftSection={<IconChecklist size={16} />}>
          New Task
        </Button>
      </Group>
      
      <Grid>
        <Grid.Col span={6}>
          <Card withBorder>
            <Title order={4}>My Lists</Title>
            <Text size="sm" c="dimmed" mt="xs">
              Quick access to your personal task lists
            </Text>
            {/* Placeholder content */}
            <Stack gap="xs" mt="md">
              <Paper p="sm" withBorder>
                <Group justify="space-between">
                  <Text size="sm">Personal Projects</Text>
                  <Badge size="sm" variant="light">12 tasks</Badge>
                </Group>
              </Paper>
              <Paper p="sm" withBorder>
                <Group justify="space-between">
                  <Text size="sm">Work Items</Text>
                  <Badge size="sm" variant="light">8 tasks</Badge>
                </Group>
              </Paper>
              <Paper p="sm" withBorder>
                <Group justify="space-between">
                  <Text size="sm">Shopping List</Text>
                  <Badge size="sm" variant="light">5 tasks</Badge>
                </Group>
              </Paper>
            </Stack>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={6}>
          <Card withBorder>
            <Title order={4}>Recent Tasks</Title>
            <Text size="sm" c="dimmed" mt="xs">
              Your recently modified tasks
            </Text>
            {/* Placeholder content */}
            <Stack gap="xs" mt="md">
              <Paper p="sm" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm">Complete project proposal</Text>
                    <Text size="xs" c="dimmed">Updated 2 hours ago</Text>
                  </div>
                  <Badge size="sm" color="orange">In Progress</Badge>
                </Group>
              </Paper>
              <Paper p="sm" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm">Review code changes</Text>
                    <Text size="xs" c="dimmed">Updated 1 day ago</Text>
                  </div>
                  <Badge size="sm" color="green">Completed</Badge>
                </Group>
              </Paper>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

/**
 * @description Stats & Progress tab placeholder component
 */
function StatsAndProgressTab() {
  return (
    <Stack gap="lg">
      <Title order={2}>Stats & Progress</Title>
      
      <Grid>
        <Grid.Col span={4}>
          <Card withBorder padding="lg">
            <Group>
              <ThemeIcon size="lg" color="green">
                <IconTrophy size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Completed Tasks</Text>
                <Text size="xl" fw={700}>24</Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={4}>
          <Card withBorder padding="lg">
            <Group>
              <ThemeIcon size="lg" color="blue">
                <IconChecklist size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Active Tasks</Text>
                <Text size="xl" fw={700}>8</Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>
        
        <Grid.Col span={4}>
          <Card withBorder padding="lg">
            <Group>
              <ThemeIcon size="lg" color="yellow">
                <IconStar size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Points Earned</Text>
                <Text size="xl" fw={700}>150</Text>
              </div>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder>
        <Title order={4} mb="md">Weekly Progress</Title>
        <Text size="sm" c="dimmed">
          Track your productivity trends over time
        </Text>
        {/* Placeholder for charts */}
        <Paper p="xl" mt="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)', minHeight: 200 }}>
          <Group justify="center" align="center" h="100%">
            <Text c="dimmed">Chart visualization coming soon</Text>
          </Group>
        </Paper>
      </Card>
    </Stack>
  );
}

interface MyHubProps {
  currentPage?: string;
  onNavigate?: (pageId: string) => void;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    points?: number;
    level?: number;
  } | null;
  onLogout?: () => void;
}

/**
 * @description My Hub main component with tabbed interface
 */
export function MyHub({ currentPage, onNavigate, user, onLogout }: MyHubProps) {
  const [activeTab, setActiveTab] = useState<string | null>('dashboard');

  return (
    <AppLayout 
      currentPage={currentPage}
      onNavigate={onNavigate}
      user={user}
      onLogout={onLogout}
    >
      <Container size="xl" py="md">
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between" align="center">
            <div>
              <Title order={1}>My Hub</Title>
              <Text size="sm" c="dimmed">
                Your personal command center for tasks, progress, and productivity
              </Text>
            </div>
          </Group>

          {/* Tabs */}
          <Tabs value={activeTab} onChange={setActiveTab} variant="outline">
            <Tabs.List grow>
              <Tabs.Tab 
                value="dashboard" 
                leftSection={<IconHome size={16} />}
              >
                Dashboard
              </Tabs.Tab>
              <Tabs.Tab 
                value="lists-tasks" 
                leftSection={<IconChecklist size={16} />}
              >
                Lists & Tasks
              </Tabs.Tab>
              <Tabs.Tab 
                value="stats-progress" 
                leftSection={<IconChartBar size={16} />}
              >
                Stats & Progress
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="dashboard" pt="lg">
              {/* Use the existing Dashboard component content */}
              <DashboardContent 
                user={user}
                onNavigation={onNavigate}
                onLogout={onLogout}
                isEmbedded={true}
              />
            </Tabs.Panel>

            <Tabs.Panel value="lists-tasks" pt="lg">
              <ListsAndTasksTab />
            </Tabs.Panel>

            <Tabs.Panel value="stats-progress" pt="lg">
              <StatsAndProgressTab />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>
    </AppLayout>
  );
}