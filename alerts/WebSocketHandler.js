const logger = require('../utils/logger');
const { TransactionOperations, AnomalyOperations, AlertOperations } = require('../db/operations');

class WebSocketHandler {
  constructor(io, alertSystem) {
    this.io = io;
    this.alertSystem = alertSystem;
    this.connectedClients = new Map();
    this.subscriptions = new Map();
  }

  // Initialize WebSocket handlers
  initialize() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket handler initialized');
  }

  // Handle new client connection
  handleConnection(socket) {
    const clientId = socket.id;
    logger.info(`Client connected: ${clientId}`);

    // Store client info
    this.connectedClients.set(clientId, {
      socket,
      connectedAt: new Date(),
      subscriptions: new Set()
    });

    // Set up event handlers
    this.setupEventHandlers(socket);

    // Send initial data
    this.sendInitialData(socket);
  }

  // Set up event handlers for a socket
  setupEventHandlers(socket) {
    const clientId = socket.id;

    // Handle subscription requests
    socket.on('subscribe', (data) => {
      this.handleSubscription(clientId, data);
    });

    // Handle unsubscription requests
    socket.on('unsubscribe', (data) => {
      this.handleUnsubscription(clientId, data);
    });

    // Handle alert acknowledgment
    socket.on('acknowledge_alert', async (data) => {
      try {
        await this.alertSystem.acknowledgeAlert(data.alertId, data.acknowledgedBy, data.notes);
        socket.emit('alert_acknowledged', { success: true, alertId: data.alertId });
      } catch (error) {
        socket.emit('alert_acknowledged', { success: false, error: error.message });
      }
    });

    // Handle alert resolution
    socket.on('resolve_alert', async (data) => {
      try {
        await this.alertSystem.resolveAlert(data.alertId, data.resolvedBy, data.notes);
        socket.emit('alert_resolved', { success: true, alertId: data.alertId });
      } catch (error) {
        socket.emit('alert_resolved', { success: false, error: error.message });
      }
    });

    // Handle dashboard data requests
    socket.on('request_dashboard_data', async () => {
      await this.sendDashboardData(socket);
    });

    // Handle transaction details request
    socket.on('request_transaction_details', async (data) => {
      await this.sendTransactionDetails(socket, data.transactionId);
    });

    // Handle anomaly details request
    socket.on('request_anomaly_details', async (data) => {
      await this.sendAnomalyDetails(socket, data.anomalyId);
    });

    // Handle network statistics request
    socket.on('request_network_stats', async () => {
      await this.sendNetworkStats(socket);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(clientId);
    });
  }

  // Handle client subscription
  handleSubscription(clientId, data) {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    const { type, filters } = data;
    
    client.subscriptions.add(type);
    
    // Store subscription filters
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Map());
    }
    this.subscriptions.get(type).set(clientId, filters || {});

    logger.debug(`Client ${clientId} subscribed to ${type}`);
    client.socket.emit('subscription_confirmed', { type, success: true });
  }

  // Handle client unsubscription
  handleUnsubscription(clientId, data) {
    const client = this.connectedClients.get(clientId);
    if (!client) return;

    const { type } = data;
    
    client.subscriptions.delete(type);
    
    if (this.subscriptions.has(type)) {
      this.subscriptions.get(type).delete(clientId);
    }

    logger.debug(`Client ${clientId} unsubscribed from ${type}`);
    client.socket.emit('unsubscription_confirmed', { type, success: true });
  }

  // Send initial data to new client
  async sendInitialData(socket) {
    try {
      // Send recent alerts
      const recentAlerts = await this.alertSystem.getRecentAlerts(10);
      socket.emit('initial_alerts', recentAlerts);

      // Send system status
      const systemStats = await this.alertSystem.getStats();
      socket.emit('system_status', systemStats);

      logger.debug(`Initial data sent to client ${socket.id}`);
    } catch (error) {
      logger.error('Error sending initial data:', error);
    }
  }

  // Send dashboard data
  async sendDashboardData(socket) {
    try {
      const [
        recentTransactions,
        recentAnomalies,
        recentAlerts,
        systemStats
      ] = await Promise.all([
        TransactionOperations.getPaginated({ limit: 20, sortBy: 'timestamp', sortOrder: 'desc' }),
        AnomalyOperations.getPaginated({ limit: 10, sortBy: 'detectedAt', sortOrder: 'desc' }),
        AlertOperations.getPaginated({ limit: 15, sortBy: 'createdAt', sortOrder: 'desc' }),
        this.alertSystem.getStats()
      ]);

      const dashboardData = {
        transactions: recentTransactions.transactions,
        anomalies: recentAnomalies.anomalies,
        alerts: recentAlerts.alerts,
        stats: systemStats,
        timestamp: new Date().toISOString()
      };

      socket.emit('dashboard_data', dashboardData);
    } catch (error) {
      logger.error('Error sending dashboard data:', error);
      socket.emit('dashboard_data', { error: 'Failed to load dashboard data' });
    }
  }

  // Send transaction details
  async sendTransactionDetails(socket, transactionId) {
    try {
      const transaction = await TransactionOperations.findById(transactionId);
      if (transaction) {
        socket.emit('transaction_details', transaction);
      } else {
        socket.emit('transaction_details', { error: 'Transaction not found' });
      }
    } catch (error) {
      logger.error('Error sending transaction details:', error);
      socket.emit('transaction_details', { error: 'Failed to load transaction details' });
    }
  }

  // Send anomaly details
  async sendAnomalyDetails(socket, anomalyId) {
    try {
      const anomaly = await AnomalyOperations.findById(anomalyId);
      if (anomaly) {
        socket.emit('anomaly_details', anomaly);
      } else {
        socket.emit('anomaly_details', { error: 'Anomaly not found' });
      }
    } catch (error) {
      logger.error('Error sending anomaly details:', error);
      socket.emit('anomaly_details', { error: 'Failed to load anomaly details' });
    }
  }

  // Send network statistics
  async sendNetworkStats(socket) {
    try {
      // This would integrate with the EventListenerManager to get network stats
      const networkStats = {
        ethereum: { status: 'active', lastBlock: 18500000, gasPrice: '25 gwei' },
        polygon: { status: 'active', lastBlock: 48000000, gasPrice: '30 gwei' },
        bsc: { status: 'active', lastBlock: 32000000, gasPrice: '5 gwei' }
      };

      socket.emit('network_stats', networkStats);
    } catch (error) {
      logger.error('Error sending network stats:', error);
      socket.emit('network_stats', { error: 'Failed to load network stats' });
    }
  }

  // Handle client disconnection
  handleDisconnection(clientId) {
    logger.info(`Client disconnected: ${clientId}`);
    
    // Clean up client data
    this.connectedClients.delete(clientId);
    
    // Clean up subscriptions
    for (const [type, clients] of this.subscriptions.entries()) {
      clients.delete(clientId);
    }
  }

  // Broadcast real-time update to subscribed clients
  broadcastUpdate(type, data) {
    if (!this.subscriptions.has(type)) return;

    const subscribers = this.subscriptions.get(type);
    
    for (const [clientId, filters] of subscribers.entries()) {
      const client = this.connectedClients.get(clientId);
      if (!client) continue;

      // Apply filters if any
      if (this.matchesFilters(data, filters)) {
        client.socket.emit('realtime_update', {
          type,
          data,
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.debug(`Broadcasted ${type} update to ${subscribers.size} subscribers`);
  }

  // Check if data matches client filters
  matchesFilters(data, filters) {
    if (!filters || Object.keys(filters).length === 0) return true;

    // Apply chainId filter
    if (filters.chainId && data.chainId !== filters.chainId) {
      return false;
    }

    // Apply severity filter
    if (filters.severity && data.severity !== filters.severity) {
      return false;
    }

    // Apply type filter
    if (filters.type && data.type !== filters.type) {
      return false;
    }

    return true;
  }

  // Get connection statistics
  getStats() {
    const stats = {
      connectedClients: this.connectedClients.size,
      subscriptions: {}
    };

    for (const [type, clients] of this.subscriptions.entries()) {
      stats.subscriptions[type] = clients.size;
    }

    return stats;
  }

  // Broadcast system status update
  broadcastSystemStatus(status) {
    this.io.emit('system_status', {
      ...status,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast alert to all connected clients
  broadcastAlert(alert) {
    this.io.emit('new_alert', {
      alert,
      timestamp: new Date().toISOString()
    });
  }

  // Broadcast transaction update
  broadcastTransaction(transaction) {
    this.broadcastUpdate('transaction', transaction);
  }

  // Broadcast anomaly update
  broadcastAnomaly(anomaly) {
    this.broadcastUpdate('anomaly', anomaly);
  }
}

module.exports = WebSocketHandler;
