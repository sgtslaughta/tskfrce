/**
 * ReadReceiptIndicator Component
 * 
 * Displays message delivery and read status with user avatars and timestamps.
 * Shows sent, delivered, read, and failed states for messages.
 */

import React from 'react';
import {
  Box,
  Avatar,
  Tooltip,
  Text,
  Chip,
  Group,
  Stack,
  useMantineTheme
} from '@mantine/core';
import {
  IconCheck as SentIcon,
  IconChecks as DeliveredIcon,
  IconEye as ReadIcon,
  IconExclamationCircle as FailedIcon,
  IconClock as SendingIcon
} from '@tabler/icons-react';
import { format } from 'date-fns';

import { MessageDeliveryStatus } from '../../types/messaging';
import { User } from '../../types/user';

interface ReadReceiptIndicatorProps {
  /** Message delivery status */
  deliveryStatus: MessageDeliveryStatus;
  /** Current user ID to determine if this is own message */
  currentUserId: number;
  /** Show detailed status (default: false for compact view) */
  detailed?: boolean;
  /** Size variant */
  size?: 'small' | 'medium';
}

/**
 * ReadReceiptIndicator displays message delivery and read status
 */
export const ReadReceiptIndicator: React.FC<ReadReceiptIndicatorProps> = ({
  deliveryStatus,
  currentUserId,
  detailed = false,
  size = 'small'
}) => {
  const theme = useMantineTheme();

  const getStatusIcon = () => {
    const iconSize = size === 'small' ? 16 : 20;
    
    switch (deliveryStatus.status) {
      case 'sending':
        return <SendingIcon size={iconSize} style={{ color: theme.colors.gray[6] }} />;
      case 'sent':
        return <SentIcon size={iconSize} style={{ color: theme.colors.gray[6] }} />;
      case 'delivered':
        return <DeliveredIcon size={iconSize} style={{ color: theme.colors.gray[6] }} />;
      case 'read':
        return <ReadIcon size={iconSize} style={{ color: theme.colors.primary[6] }} />;
      case 'failed':
        return <FailedIcon size={iconSize} style={{ color: theme.colors.red[6] }} />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (deliveryStatus.status) {
      case 'sending':
        return 'Sending...';
      case 'sent':
        return 'Sent';
      case 'delivered':
        return `Delivered to ${deliveryStatus.delivered_to?.length || 0}`;
      case 'read':
        return `Read by ${deliveryStatus.read_by?.length || 0}`;
      case 'failed':
        return 'Failed to send';
      default:
        return '';
    }
  };

  const getTooltipContent = () => {
    const { status, delivered_to, read_by, failed_recipients } = deliveryStatus;
    
    if (status === 'failed' && failed_recipients?.length) {
      return (
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Failed to send to:
          </Text>
          {failed_recipients.map(({ user, error }) => (
            <Text key={user.id} size="sm">
              {user.username}: {error}
            </Text>
          ))}
        </Stack>
      );
    }

    if (status === 'read' && read_by?.length) {
      return (
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Read by:
          </Text>
          {read_by.map(({ user, read_at }) => (
            <Text key={user.id} size="sm">
              {user.username} • {format(new Date(read_at), 'MMM d, h:mm a')}
            </Text>
          ))}
        </Stack>
      );
    }

    if (status === 'delivered' && delivered_to?.length) {
      return (
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Delivered to:
          </Text>
          {delivered_to.map((user) => (
            <Text key={user.id} size="sm">
              {user.username}
            </Text>
          ))}
        </Stack>
      );
    }

    return getStatusText();
  };

  // Don't show read receipts for messages from other users to current user
  if (deliveryStatus.status === 'read' && currentUserId !== deliveryStatus.message_id) {
    return null;
  }

  if (detailed) {
    return (
      <Stack gap="xs" mt="xs">
        <Group gap="xs" align="center">
          {getStatusIcon()}
          <Text size="xs" c="dimmed">
            {getStatusText()}
          </Text>
        </Group>
        
        {deliveryStatus.status === 'read' && deliveryStatus.read_by?.length && (
          <Group gap="xs">
            {deliveryStatus.read_by.slice(0, 3).map(({ user }) => (
              <Tooltip key={user.id} label={user.username}>
                <Avatar
                  src={user.avatar_url}
                  size={20}
                  radius="xl"
                  style={{ fontSize: '0.75rem' }}
                >
                  {user.username[0]?.toUpperCase()}
                </Avatar>
              </Tooltip>
            ))}
            {deliveryStatus.read_by.length > 3 && (
              <Text size="xs" c="dimmed">
                +{deliveryStatus.read_by.length - 3} more
              </Text>
            )}
          </Group>
        )}

        {deliveryStatus.status === 'failed' && deliveryStatus.failed_recipients?.length && (
          <Box mt="xs">
            <Chip
              color="red"
              size="xs"
              variant="outline"
            >
              Failed: {deliveryStatus.failed_recipients.length} recipient(s)
            </Chip>
          </Box>
        )}
      </Stack>
    );
  }

  // Compact view
  return (
    <Tooltip label={getTooltipContent()}>
      <Group
        gap="xs"
        align="center"
        ml="xs"
        style={{ cursor: 'help' }}
      >
        {getStatusIcon()}
        {deliveryStatus.status === 'read' && deliveryStatus.read_by?.length && (
          <Group gap={2}>
            {deliveryStatus.read_by.slice(0, 2).map(({ user }) => (
              <Avatar
                key={user.id}
                src={user.avatar_url}
                size={16}
                radius="xl"
                style={{ fontSize: '0.6rem' }}
              >
                {user.username[0]?.toUpperCase()}
              </Avatar>
            ))}
          </Group>
        )}
      </Group>
    </Tooltip>
  );
};

export default ReadReceiptIndicator;