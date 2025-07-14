import React, { useState, useEffect } from 'react';
import { useSocket } from '../../contexts/SocketContext';

interface Network {
  status: string;
  volume: number;
  transactions: number;
}

interface NetworkStatusProps {
  networks: { [key: string]: Network };
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ networks }) => {
  const [listenerStatus, setListenerStatus] = useState<any>(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (socket) {
      // Listen for listener status updates
      socket.on('listener_status', (status) => {
        setListenerStatus(status);
      });

      return () => {
        socket.off('listener_status');
      };
    }
  }, [socket]);

  const getNetworkIcon = (networkName: string) => {
    switch (networkName.toLowerCase()) {
      case 'ethereum':
        return (
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">ETH</span>
          </div>
        );
      case 'polygon':
        return (
          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">POL</span>
          </div>
        );
      case 'bsc':
        return (
          <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">BSC</span>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">?</span>
          </div>
        );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'inactive':
      case 'disconnected':
        return 'text-red-600 bg-red-100';
      case 'connecting':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
      case 'disconnected':
        return 'bg-red-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Network Status</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${listenerStatus?.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {listenerStatus?.activeListeners || 0}/{listenerStatus?.totalNetworks || 0} Active
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(networks).map(([networkName, network]) => {
          const listenerInfo = listenerStatus?.networks?.[networkName];
          const isListening = listenerInfo?.isListening || false;
          
          return (
            <div key={networkName} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {getNetworkIcon(networkName)}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 capitalize">
                    {networkName}
                  </h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusDot(isListening ? 'active' : 'inactive')}`}></div>
                    <span className="text-xs text-gray-500">
                      {isListening ? 'Listening' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  ${network.volume.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  {network.transactions} txns
                </div>
                {listenerInfo?.lastProcessedBlock && (
                  <div className="text-xs text-gray-400 mt-1">
                    Block: {listenerInfo.lastProcessedBlock.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall system status */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">System Health</span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              listenerStatus?.activeListeners === listenerStatus?.totalNetworks 
                ? 'bg-green-500' 
                : listenerStatus?.activeListeners > 0 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium text-gray-900">
              {listenerStatus?.activeListeners === listenerStatus?.totalNetworks 
                ? 'All Systems Operational' 
                : listenerStatus?.activeListeners > 0 
                  ? 'Partial Service' 
                  : 'Service Disrupted'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;
