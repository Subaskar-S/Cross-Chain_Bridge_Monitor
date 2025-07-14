import React, { useState, useEffect } from 'react';
import { useApi } from '../contexts/ApiContext';
import { useSocket } from '../contexts/SocketContext';
import StatsCard from '../components/Dashboard/StatsCard';
import VolumeChart from '../components/Dashboard/VolumeChart';
import NetworkStatus from '../components/Dashboard/NetworkStatus';
import RecentTransactions from '../components/Dashboard/RecentTransactions';
import RecentAlerts from '../components/Dashboard/RecentAlerts';
import SystemHealth from '../components/Dashboard/SystemHealth';

interface DashboardData {
  volume: {
    last24h: { volume: number; transactions: number };
    last7d: { volume: number; transactions: number };
    change24h: number;
  };
  transactions: {
    counts: { [key: string]: number };
    recent: any[];
  };
  anomalies: {
    counts: any[];
  };
  alerts: {
    counts: any[];
  };
  networks: {
    [key: string]: {
      status: string;
      volume: number;
      transactions: number;
    };
  };
}

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get } = useApi();
  const { socket, connected } = useSocket();

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await get('/volume/dashboard');
      setDashboardData(response.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Set up real-time updates
  useEffect(() => {
    if (socket && connected) {
      // Request initial dashboard data via socket
      socket.emit('request_dashboard_data');

      // Listen for dashboard updates
      socket.on('dashboard_data', (data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setDashboardData(data);
          setError(null);
        }
        setLoading(false);
      });

      // Listen for real-time updates
      socket.on('realtime_update', (update) => {
        // Update dashboard data based on real-time events
        if (update.type === 'transaction' || update.type === 'anomaly' || update.type === 'alert') {
          // Refresh dashboard data
          fetchDashboardData();
        }
      });

      return () => {
        socket.off('dashboard_data');
        socket.off('realtime_update');
      };
    }
  }, [socket, connected]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        fetchDashboardData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading]);

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="mt-2 text-sm text-red-800 underline hover:text-red-900"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <div className={`flex items-center space-x-2 ${connected ? 'text-green-600' : 'text-red-600'}`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm font-medium">
              {connected ? 'Live Updates' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            <svg className={`-ml-0.5 mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="24h Volume"
            value={`$${dashboardData.volume.last24h.volume.toLocaleString()}`}
            change={dashboardData.volume.change24h}
            icon="chart"
          />
          <StatsCard
            title="24h Transactions"
            value={dashboardData.volume.last24h.transactions.toLocaleString()}
            change={0}
            icon="transactions"
          />
          <StatsCard
            title="Active Alerts"
            value={(dashboardData.alerts.counts.find((c: any) => c._id === 'pending')?.totalCount || 0).toString()}
            change={0}
            icon="alerts"
          />
          <StatsCard
            title="Anomalies"
            value={(dashboardData.anomalies.counts.find((c: any) => c._id === 'active')?.totalCount || 0).toString()}
            change={0}
            icon="anomalies"
          />
        </div>
      )}

      {/* Charts and network status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VolumeChart />
        </div>
        <div>
          <NetworkStatus networks={dashboardData?.networks || {}} />
        </div>
      </div>

      {/* System health */}
      <SystemHealth />

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentTransactions transactions={dashboardData?.transactions.recent || []} />
        <RecentAlerts />
      </div>
    </div>
  );
};

export default Dashboard;
