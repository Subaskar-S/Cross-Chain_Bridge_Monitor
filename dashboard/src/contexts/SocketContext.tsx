import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  subscribe: (event: string, callback: (data: any) => void) => void;
  unsubscribe: (event: string) => void;
  emit: (event: string, data?: any) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to the server
    const socketInstance = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnected(false);
    });

    // Set up real-time event listeners
    socketInstance.on('realtime_update', (data) => {
      console.log('Real-time update:', data);
      // This will be handled by individual components that subscribe
    });

    socketInstance.on('new_alert', (data) => {
      console.log('New alert:', data);
      // This will trigger notifications
    });

    socketInstance.on('system_status', (data) => {
      console.log('System status update:', data);
    });

    socketInstance.on('listener_status', (data) => {
      console.log('Listener status update:', data);
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const subscribe = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const unsubscribe = (event: string) => {
    if (socket) {
      socket.off(event);
    }
  };

  const emit = (event: string, data?: any) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  };

  const value: SocketContextType = {
    socket,
    connected,
    subscribe,
    unsubscribe,
    emit
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
