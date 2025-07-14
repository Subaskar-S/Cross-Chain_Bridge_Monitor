import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Anomalies from './pages/Anomalies';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import { SocketProvider } from './contexts/SocketContext';
import { ApiProvider } from './contexts/ApiContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ApiProvider>
      <SocketProvider>
        <NotificationProvider>
          <Router>
            <div className="flex h-screen bg-gray-50">
              {/* Sidebar */}
              <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
              
              {/* Main content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <Header onMenuClick={() => setSidebarOpen(true)} />
                
                {/* Page content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/anomalies" element={<Anomalies />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </main>
              </div>
            </div>
          </Router>
        </NotificationProvider>
      </SocketProvider>
    </ApiProvider>
  );
}

export default App;
