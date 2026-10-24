import { ReactNode } from 'react';
import { Button } from '@mantine/core';
import { Icon } from './Icon';

export interface EmptyStateProps {
  icon: string;
  title: string;
  body: string;
  actions?: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'default' }>;
}

/**
 * Empty state: no data to display, with optional actions.
 */
export function EmptyState({ icon, title, body, actions }: EmptyStateProps) {
  return (
    <div className="p-empty-state">
      <div className="p-state-icon">
        <Icon name={icon} size={32} />
      </div>
      <h3 className="p-state-title">{title}</h3>
      <p className="p-state-body">{body}</p>
      {actions && actions.length > 0 && (
        <div className="p-state-actions">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant === 'primary' ? 'filled' : 'default'}
              onClick={action.onClick}
              leftSection={<Icon name="add" size={16} />}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SkeletonProps {
  rows?: number;
}

/**
 * Loading skeleton: placeholder cards with shimmer animation.
 */
export function Skeleton({ rows = 2 }: SkeletonProps) {
  return (
    <div className="p-skeleton" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk" style={{ height: 120, borderRadius: 8 }} />
      ))}
    </div>
  );
}

export type ErrorKind = 'unreachable' | 'crash' | 'notfound' | 'expired';

export interface ErrorPanelProps {
  kind: ErrorKind;
  onRetry?: () => void;
}

const ERROR_COPY: Record<ErrorKind, { icon: string; title: string; body: string }> = {
  unreachable: {
    icon: 'wifi_off',
    title: "Can't reach your home box",
    body: 'Are you on the home Wi-Fi? If you\'re away, connect Tailscale first.',
  },
  crash: {
    icon: 'sentiment_dissatisfied',
    title: 'Something went wrong',
    body: 'This page hit an error. Your data is safe.',
  },
  notfound: {
    icon: 'link_off',
    title: "That page isn't here",
    body: 'The link may be old, or the chore was deleted.',
  },
  expired: {
    icon: 'timer_off',
    title: 'This invite has expired',
    body: 'Invites last 24 hours and reset links 30 minutes. Ask a parent for a new one.',
  },
};

/**
 * Error panel: something went wrong, with optional retry.
 */
export function ErrorPanel({ kind, onRetry }: ErrorPanelProps) {
  const copy = ERROR_COPY[kind];
  const actions: EmptyStateProps['actions'] = [];

  if (kind === 'unreachable' || kind === 'crash') {
    actions.push({
      label: 'Try again',
      onClick: onRetry || (() => window.location.reload()),
      variant: 'primary',
    });
  }

  if (kind === 'notfound') {
    actions.push({
      label: 'Go to Today',
      onClick: () => (window.location.href = '/'),
      variant: 'primary',
    });
  }

  if (kind === 'expired') {
    actions.push({
      label: 'Back to log in',
      onClick: () => (window.location.href = '/login'),
    });
  }

  return (
    <EmptyState
      icon={copy.icon}
      title={copy.title}
      body={copy.body}
      actions={actions}
    />
  );
}

export type BannerTone = 'red' | 'amb';

export interface BannerProps {
  tone: BannerTone;
  icon: string;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}

/**
 * Banner: alert or warning at the top of a page or section.
 */
export function Banner({ tone, icon, title, body, action }: BannerProps) {
  return (
    <div className="p-banner" data-tone={tone}>
      <Icon name={icon} size={18} />
      <div className="p-banner-text">
        <div className="p-banner-title">{title}</div>
        {body && <div className="p-banner-body">{body}</div>}
      </div>
      {action && (
        <Button
          variant="default"
          size="xs"
          onClick={action.onClick}
          style={{ marginLeft: 'auto' }}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
