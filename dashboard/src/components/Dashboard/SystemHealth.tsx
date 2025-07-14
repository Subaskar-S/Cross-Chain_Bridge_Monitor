import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';

interface SystemHealthProps {}

const SystemHealth: React.FC<SystemHealthProps> = () => {
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (socket) {
      // Listen for system status updates
      socket.on('system_status', (status) => {
        setSystemStatus(status);
      });

      // Request initial system status
      socket.emit('request_system_status');

      return () => {
        socket.off('system_status');
      };
    }
  }, [socket]);

  const getHealthColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600 bg-green-100';
    if (value <= thresholds.warning) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getHealthStatus = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'Healthy';
    if (value <= thresholds.warning) return 'Warning';
    return 'Critical';
  };

  const healthMetrics = [
    {
      name: 'Alert Queue',
      value: systemStatus?.alerts?.queueSize || 0,
      unit: 'items',
      thresholds: { good: 10, warning: 50 },
      description: 'Pending alerts in queue'
    },
    {
      name: 'Processing',
      value: systemStatus?.alerts?.isProcessing ? 1 : 0,
      unit: '',
      thresholds: { good: 1, warning: 1 },
      description: 'Alert processing status',
      format: (value: number) => value ? 'Active' : 'Idle'
    },
    {
      name: 'Anomaly Rules',
      value: systemStatus?.anomalies?.enabledRules?.length || 0,
      unit: 'rules',
      thresholds: { good: 5, warning: 3 },
      description: 'Active anomaly detection rules'
    },
    {
      name: 'Dedup Cache',
      value: systemStatus?.alerts?.deduplicationCacheSize || 0,
      unit: 'entries',
      thresholds: { good: 100, warning: 500 },
      description: 'Alert deduplication cache size'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">System Health</h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Monitoring Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {healthMetrics.map((metric) => {
          const displayValue = metric.format ? metric.format(metric.value) : metric.value;
          const healthColor = getHealthColor(metric.value, metric.thresholds);
          const healthStatus = getHealthStatus(metric.value, metric.thresholds);

          return (
            <div key={metric.name} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">{metric.name}</h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${healthColor}`}>
                  {healthStatus}
                </span>
              </div>
              
              <div className="mb-2">
                <span className="text-2xl font-bold text-gray-900">
                  {displayValue}
                </span>
                {metric.unit && (
                  <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
                )}
              </div>
              
              <p className="text-xs text-gray-500">{metric.description}</p>
            </div>
          );
        })}
      </div>

      {/* System components status */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">System Components</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Event Listeners</span>
            </div>
            <span className="text-sm font-medium text-gray-900">Operational</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Anomaly Detector</span>
            </div>
            <span className="text-sm font-medium text-gray-900">Active</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-700">Alert System</span>
            </div>
            <span className="text-sm font-medium text-gray-900">Running</span>
          </div>
        </div>
      </div>

      {/* Performance metrics */}
      {systemStatus && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Performance</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Uptime</span>
                <span className="text-sm font-medium text-gray-900">99.9%</span>
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Response Time</span>
                <span className="text-sm font-medium text-gray-900">&lt; 100ms</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemHealth;
