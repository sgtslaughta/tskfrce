/**
 * @fileoverview Toast Notification Container Component
 * @description Displays toast notifications with animations and actions
 * @author TaaskMaaster Team
 * @version 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { cn } from '../../design-system/utils/cn';
import { Button } from '../../design-system/components/Button';
import { useNotifications, type Toast } from '../../contexts/NotificationContext';
import {
  IconCircleCheck as CheckCircleIcon,
  IconAlertTriangle as ExclamationTriangleIcon,
  IconInfoCircle as InformationCircleIcon,
  IconCircleX as XCircleIcon,
  IconX as XMarkIcon
} from '@tabler/icons-react';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

/**
 * @description Individual toast item component
 */
const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  /**
   * @description Handle dismiss with exit animation
   */
  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300);
  };

  /**
   * @description Get toast icon based on type
   */
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  /**
   * @description Get toast styling based on type
   */
  const getToastStyle = () => {
    const baseStyle = "border-l-4 bg-white dark:bg-gray-800 shadow-lg";
    
    switch (toast.type) {
      case 'success':
        return `${baseStyle} border-green-500`;
      case 'error':
        return `${baseStyle} border-red-500`;
      case 'warning':
        return `${baseStyle} border-yellow-500`;
      case 'info':
        return `${baseStyle} border-blue-500`;
      default:
        return `${baseStyle} border-gray-500`;
    }
  };

  return (
    <div
      className={cn(
        "relative max-w-xs sm:max-w-md w-full rounded-lg p-3 sm:p-4 transition-all duration-300 ease-in-out",
        getToastStyle(),
        isVisible && !isExiting 
          ? "transform translate-x-0 opacity-100" 
          : "transform translate-x-full opacity-0"
      )}
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            {toast.title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {toast.message}
          </p>
          
          {/* Actions */}
          {toast.actions && toast.actions.length > 0 && (
            <div className="flex items-center space-x-2 mt-3">
              {toast.actions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant === 'primary' ? 'primary' : 'secondary'}
                  onClick={() => {
                    action.onClick();
                    handleDismiss();
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar for timed toasts */}
      {!toast.persistent && toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600 rounded-b-lg overflow-hidden">
          <div
            className={cn(
              "h-full transition-all ease-linear",
              toast.type === 'success' && "bg-green-500",
              toast.type === 'error' && "bg-red-500",
              toast.type === 'warning' && "bg-yellow-500",
              toast.type === 'info' && "bg-blue-500"
            )}
            style={{
              animation: `shrink ${toast.duration}ms linear forwards`
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * @description Toast Container Component
 */
export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <>
      {/* Toast Container */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 space-y-2 sm:space-y-3 pointer-events-none">
        <div className="space-y-2 sm:space-y-3 pointer-events-auto">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
            />
          ))}
        </div>
      </div>

      {/* CSS Animation for progress bar */}
      <style>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </>
  );
};

export default ToastContainer;
