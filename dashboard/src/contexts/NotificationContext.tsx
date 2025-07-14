import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useSocket } from './SocketContext';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { socket } = useSocket();

  // Listen for real-time alerts
  useEffect(() => {
    if (socket) {
      socket.on('new_alert', (data) => {
        addNotification({
          type: getSeverityType(data.alert?.severity || 'info'),
          title: 'New Alert',
          message: data.alert?.title || 'A new alert has been generated',
          autoClose: true,
          duration: 8000
        });
      });

      socket.on('realtime_update', (data) => {
        if (data.type === 'anomaly' && data.data.severity === 'critical') {
          addNotification({
            type: 'error',
            title: 'Critical Anomaly Detected',
            message: data.data.title || 'A critical anomaly has been detected',
            autoClose: true,
            duration: 10000
          });
        }
      });

      return () => {
        socket.off('new_alert');
        socket.off('realtime_update');
      };
    }
  }, [socket]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      timestamp: new Date(),
      autoClose: notification.autoClose ?? true,
      duration: notification.duration ?? 5000
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remove notification if autoClose is enabled
    if (newNotification.autoClose) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, newNotification.duration);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    clearAll
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Helper functions
const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

const getSeverityType = (severity: string): 'success' | 'error' | 'warning' | 'info' => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'error';
    case 'high':
    case 'warning':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
    case 'info':
      return 'info';
    default:
      return 'info';
  }
};
