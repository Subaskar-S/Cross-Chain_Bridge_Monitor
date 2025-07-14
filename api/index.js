const express = require('express');
const { optionalAuth } = require('./middleware/auth');
const { publicLimit, authenticatedLimit } = require('./middleware/rateLimit');

// Import route handlers
const transactionRoutes = require('./transactions');
const anomalyRoutes = require('./anomalies');
const alertRoutes = require('./alerts');
const volumeRoutes = require('./volume');

const router = express.Router();

// Apply middleware
router.use(optionalAuth);

// Apply rate limiting based on authentication
router.use((req, res, next) => {
  if (req.isAuthenticated) {
    authenticatedLimit(req, res, next);
  } else {
    publicLimit(req, res, next);
  }
});

// API routes
router.use('/transactions', transactionRoutes);
router.use('/anomalies', anomalyRoutes);
router.use('/alerts', alertRoutes);
router.use('/volume', volumeRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Cross-Chain Bridge Monitoring API',
    version: '1.0.0',
    endpoints: {
      transactions: '/api/transactions',
      anomalies: '/api/anomalies',
      alerts: '/api/alerts',
      volume: '/api/volume'
    },
    documentation: '/api/docs',
    authenticated: req.isAuthenticated || false
  });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    documentation: {
      transactions: {
        'GET /api/transactions': 'Get paginated transactions with filters',
        'GET /api/transactions/:id': 'Get transaction by ID',
        'GET /api/transactions/hash/:hash': 'Get transaction by hash (requires chainId)',
        'GET /api/transactions/bridge/:bridgeId': 'Get transactions by bridge ID',
        'GET /api/transactions/unmatched/:chainId': 'Get unmatched transactions',
        'GET /api/transactions/stats/status': 'Get transaction status counts',
        'PUT /api/transactions/:id/status': 'Update transaction status',
        'POST /api/transactions/:id/match': 'Manually match transactions',
        'GET /api/transactions/search': 'Search transactions'
      },
      anomalies: {
        'GET /api/anomalies': 'Get paginated anomalies with filters',
        'GET /api/anomalies/:id': 'Get anomaly by ID',
        'GET /api/anomalies/active/:chainId?': 'Get active anomalies',
        'GET /api/anomalies/severity/:severity': 'Get anomalies by severity',
        'GET /api/anomalies/stats/types': 'Get anomaly statistics by type',
        'GET /api/anomalies/stats/status': 'Get anomaly status counts',
        'PUT /api/anomalies/:id/resolve': 'Resolve an anomaly',
        'PUT /api/anomalies/:id/false-positive': 'Mark anomaly as false positive',
        'PUT /api/anomalies/:id/severity': 'Update anomaly severity',
        'GET /api/anomalies/duplicates/:transactionHash': 'Find duplicate anomalies',
        'POST /api/anomalies/:id/alert': 'Add alert to anomaly',
        'DELETE /api/anomalies/cleanup': 'Clean up old anomalies'
      },
      alerts: {
        'GET /api/alerts': 'Get paginated alerts with filters',
        'GET /api/alerts/:id': 'Get alert by ID',
        'GET /api/alerts/pending': 'Get pending alerts',
        'GET /api/alerts/retry': 'Get alerts for retry',
        'GET /api/alerts/recent': 'Get recent alerts',
        'GET /api/alerts/stats/status': 'Get alert status statistics',
        'GET /api/alerts/stats/counts': 'Get alert counts by status',
        'PUT /api/alerts/:id/acknowledge': 'Acknowledge an alert',
        'PUT /api/alerts/:id/resolve': 'Resolve an alert',
        'POST /api/alerts/:id/note': 'Add note to alert',
        'PUT /api/alerts/:id/sent': 'Mark alert as sent',
        'PUT /api/alerts/:id/failed': 'Mark alert as failed',
        'GET /api/alerts/group/:groupKey': 'Get alerts by group key',
        'DELETE /api/alerts/cleanup': 'Clean up old alerts',
        'POST /api/alerts/auto-resolve': 'Auto-resolve expired alerts'
      },
      volume: {
        'GET /api/volume': 'Get volume statistics with grouping options',
        'GET /api/volume/summary': 'Get volume summary for different periods',
        'GET /api/volume/trends': 'Get volume trends over time',
        'GET /api/volume/top-tokens': 'Get top tokens by volume',
        'GET /api/volume/dashboard': 'Get dashboard statistics'
      }
    },
    parameters: {
      common: {
        page: 'Page number for pagination (default: 1)',
        limit: 'Items per page (default: 50, max: 100)',
        startDate: 'Start date filter (ISO string)',
        endDate: 'End date filter (ISO string)',
        chainId: 'Chain ID filter (1=Ethereum, 137=Polygon, 56=BSC)',
        sortBy: 'Field to sort by',
        sortOrder: 'Sort order (asc/desc, default: desc)'
      },
      authentication: {
        'x-api-key': 'API key header for authenticated requests',
        apiKey: 'API key query parameter (alternative to header)'
      }
    },
    rateLimits: {
      public: '50 requests per 15 minutes per IP',
      authenticated: '500 requests per 15 minutes per API key'
    }
  });
});

module.exports = router;
