import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { EventType, eventBus } from '@/lib/events';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';
import { ToastAction } from '@/components/ui/toast';

/**
 * Notification types
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification data interface
 */
export interface NotificationData {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Get icon based on notification type
 */
export const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'info':
      return <Info className="h-4 w-4" />;
    case 'success':
      return <CheckCircle className="h-4 w-4" />;
    case 'warning':
      return <AlertCircle className="h-4 w-4" />;
    case 'error':
      return <XCircle className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
};

/**
 * Get variant based on notification type
 */
export const getNotificationVariant = (type: NotificationType): "default" | "destructive" => {
  switch (type) {
    case 'info':
      return 'default';
    case 'success':
      return 'default';
    case 'warning':
      return 'default'; // No warning variant, use default
    case 'error':
      return 'destructive';
    default:
      return 'default';
  }
};

/**
 * Hook to show notifications
 */
export function useNotification() {
  const { toast } = useToast();
  
  const showNotification = (data: NotificationData) => {
    toast({
      title: data.title,
      description: data.message,
      variant: getNotificationVariant(data.type),
      duration: data.duration || 5000,
      // Only add action if provided
      ...(data.action && {
        action: (
          <ToastAction
            altText={data.action.label}
            onClick={data.action.onClick}
          >
            {data.action.label}
          </ToastAction>
        )
      }),
    });
    
    // Publish notification event
    eventBus.publish(EventType.NOTIFICATION_SHOWN, {
      type: data.type,
      title: data.title,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  };
  
  return {
    showNotification,
    info: (title: string, message: string, options?: Omit<NotificationData, 'title' | 'message' | 'type'>) => 
      showNotification({ title, message, type: 'info', ...options }),
    success: (title: string, message: string, options?: Omit<NotificationData, 'title' | 'message' | 'type'>) => 
      showNotification({ title, message, type: 'success', ...options }),
    warning: (title: string, message: string, options?: Omit<NotificationData, 'title' | 'message' | 'type'>) => 
      showNotification({ title, message, type: 'warning', ...options }),
    error: (title: string, message: string, options?: Omit<NotificationData, 'title' | 'message' | 'type'>) => 
      showNotification({ title, message, type: 'error', ...options }),
  };
}

/**
 * Global notification listener component
 * This component should be mounted once at the app root level
 */
export function NotificationListener() {
  const { showNotification } = useNotification();
  
  useEffect(() => {
    // Listen for error events and show notifications
    const unsubscribeError = eventBus.subscribe(EventType.ERROR_OCCURRED, (payload) => {
      showNotification({
        type: 'error',
        title: 'Error Occurred',
        message: payload.data.message || 'An unexpected error occurred.',
        duration: 8000,
      });
    });
    
    // Listen for session events
    const unsubscribeSession = eventBus.subscribe(EventType.SESSION_UPDATED, (payload) => {
      if (payload.data.status === 'connected') {
        showNotification({
          type: 'success',
          title: 'Connected',
          message: 'Successfully connected to the server.',
          duration: 3000,
        });
      } else if (payload.data.status === 'disconnected') {
        showNotification({
          type: 'warning',
          title: 'Disconnected',
          message: 'Connection to the server was lost. Attempting to reconnect...',
          duration: 5000,
        });
      }
    });
    
    // Listen for sheet data updates
    const unsubscribeSheetData = eventBus.subscribe(EventType.SHEET_DATA_UPDATED, (payload) => {
      showNotification({
        type: 'info',
        title: 'Sheet Updated',
        message: `Sheet data has been updated.`,
        duration: 3000,
      });
    });
    
    return () => {
      unsubscribeError();
      unsubscribeSession();
      unsubscribeSheetData();
    };
  }, [showNotification]);
  
  return null; // This component doesn't render anything
}

/**
 * Helper function to show a notification from anywhere in the app
 * without needing to use the hook
 */
export function showGlobalNotification(data: NotificationData) {
  eventBus.publish(EventType.NOTIFICATION_REQUEST, data);
}