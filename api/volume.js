const express = require('express');
const { TransactionOperations, AnomalyOperations, AlertOperations } = require('../db/operations');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/volume - Get volume statistics
router.get('/', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      chainId,
      groupBy = 'chain'
    } = req.query;

    // Default to last 24 hours if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const volumeStats = await TransactionOperations.getVolumeStats(
      start,
      end,
      chainId ? parseInt(chainId) : null
    );

    // Process and format the data based on groupBy parameter
    let formattedData;
    switch (groupBy) {
      case 'chain':
        formattedData = formatByChain(volumeStats);
        break;
      case 'token':
        formattedData = formatByToken(volumeStats);
        break;
      case 'time':
        formattedData = await formatByTime(start, end, chainId);
        break;
      default:
        formattedData = volumeStats;
    }

    res.json({
      success: true,
      data: formattedData,
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      },
      chainId: chainId ? parseInt(chainId) : null,
      groupBy
    });
  } catch (error) {
    logger.error('Error fetching volume statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch volume statistics',
      message: error.message
    });
  }
});

// GET /api/volume/summary - Get volume summary
router.get('/summary', async (req, res) => {
  try {
    const {
      period = '24h'
    } = req.query;

    // Calculate time range based on period
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const timeRange = timeRanges[period] || timeRanges['24h'];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - timeRange);

    // Get volume stats for all chains
    const volumeStats = await TransactionOperations.getVolumeStats(startDate, endDate);
    
    // Get transaction counts by status
    const statusCounts = await TransactionOperations.getStatusCounts(null, timeRange);
    
    // Calculate totals
    let totalVolume = 0;
    let totalTransactions = 0;
    const chainSummary = {};

    volumeStats.forEach(chainData => {
      const chainName = getChainName(chainData._id);
      let chainVolume = 0;
      
      chainData.tokens.forEach(token => {
        chainVolume += token.volume;
      });
      
      chainSummary[chainName] = {
        chainId: chainData._id,
        volume: chainVolume,
        transactions: chainData.totalTransactions,
        tokens: chainData.tokens.length
      };
      
      totalVolume += chainVolume;
      totalTransactions += chainData.totalTransactions;
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalVolume,
          totalTransactions,
          period,
          chains: Object.keys(chainSummary).length
        },
        chainBreakdown: chainSummary,
        statusBreakdown: statusCounts,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching volume summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch volume summary',
      message: error.message
    });
  }
});

// GET /api/volume/trends - Get volume trends over time
router.get('/trends', async (req, res) => {
  try {
    const {
      period = '24h',
      interval = '1h',
      chainId
    } = req.query;

    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    const intervals = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };

    const timeRange = timeRanges[period] || timeRanges['24h'];
    const intervalMs = intervals[interval] || intervals['1h'];
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - timeRange);

    // Generate time buckets
    const buckets = [];
    for (let time = startDate.getTime(); time < endDate.getTime(); time += intervalMs) {
      buckets.push({
        timestamp: new Date(time),
        volume: 0,
        transactions: 0
      });
    }

    // This would require a more complex aggregation query in production
    // For now, return sample trend data
    const trendData = buckets.map((bucket, index) => ({
      timestamp: bucket.timestamp.toISOString(),
      volume: Math.random() * 100000 + 50000, // Sample data
      transactions: Math.floor(Math.random() * 100) + 20,
      chainId: chainId ? parseInt(chainId) : null
    }));

    res.json({
      success: true,
      data: trendData,
      period,
      interval,
      chainId: chainId ? parseInt(chainId) : null,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching volume trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch volume trends',
      message: error.message
    });
  }
});

// GET /api/volume/top-tokens - Get top tokens by volume
router.get('/top-tokens', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      chainId,
      limit = 10
    } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const volumeStats = await TransactionOperations.getVolumeStats(
      start,
      end,
      chainId ? parseInt(chainId) : null
    );

    // Flatten and sort tokens by volume
    const allTokens = [];
    volumeStats.forEach(chainData => {
      chainData.tokens.forEach(token => {
        allTokens.push({
          ...token,
          chainId: chainData._id,
          chainName: getChainName(chainData._id)
        });
      });
    });

    // Sort by volume and take top N
    const topTokens = allTokens
      .sort((a, b) => b.volume - a.volume)
      .slice(0, Math.min(50, Math.max(1, parseInt(limit))));

    res.json({
      success: true,
      data: topTokens,
      count: topTokens.length,
      limit: parseInt(limit),
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      },
      chainId: chainId ? parseInt(chainId) : null
    });
  } catch (error) {
    logger.error('Error fetching top tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top tokens',
      message: error.message
    });
  }
});

// GET /api/volume/dashboard - Get dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get various statistics in parallel
    const [
      volume24h,
      volume7d,
      transactionCounts,
      anomalyCounts,
      alertCounts,
      recentTransactions
    ] = await Promise.all([
      TransactionOperations.getVolumeStats(last24h, now),
      TransactionOperations.getVolumeStats(last7d, now),
      TransactionOperations.getStatusCounts(null, 24 * 60 * 60 * 1000),
      AnomalyOperations.getStatusCounts(null, 24 * 60 * 60 * 1000),
      AlertOperations.getStatusCounts(null, 24 * 60 * 60 * 1000),
      TransactionOperations.getPaginated({ limit: 10, sortBy: 'timestamp', sortOrder: 'desc' })
    ]);

    // Calculate totals
    const total24h = calculateTotalVolume(volume24h);
    const total7d = calculateTotalVolume(volume7d);

    const dashboardData = {
      volume: {
        last24h: total24h,
        last7d: total7d,
        change24h: total24h.volume > 0 ? ((total24h.volume - (total7d.volume / 7)) / (total7d.volume / 7)) * 100 : 0
      },
      transactions: {
        counts: transactionCounts,
        recent: recentTransactions.transactions
      },
      anomalies: {
        counts: anomalyCounts
      },
      alerts: {
        counts: alertCounts
      },
      networks: {
        ethereum: { status: 'active', volume: 0, transactions: 0 },
        polygon: { status: 'active', volume: 0, transactions: 0 },
        bsc: { status: 'active', volume: 0, transactions: 0 }
      }
    };

    // Populate network data
    volume24h.forEach(chainData => {
      const chainName = getChainName(chainData._id);
      if (dashboardData.networks[chainName]) {
        dashboardData.networks[chainName].volume = chainData.tokens.reduce((sum, token) => sum + token.volume, 0);
        dashboardData.networks[chainName].transactions = chainData.totalTransactions;
      }
    });

    res.json({
      success: true,
      data: dashboardData,
      timestamp: now.toISOString()
    });
  } catch (error) {
    logger.error('Error fetching dashboard statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
});

// Helper functions
function formatByChain(volumeStats) {
  return volumeStats.map(chainData => ({
    chainId: chainData._id,
    chainName: getChainName(chainData._id),
    totalVolume: chainData.tokens.reduce((sum, token) => sum + token.volume, 0),
    totalTransactions: chainData.totalTransactions,
    tokens: chainData.tokens
  }));
}

function formatByToken(volumeStats) {
  const allTokens = [];
  volumeStats.forEach(chainData => {
    chainData.tokens.forEach(token => {
      allTokens.push({
        ...token,
        chainId: chainData._id,
        chainName: getChainName(chainData._id)
      });
    });
  });
  return allTokens.sort((a, b) => b.volume - a.volume);
}

async function formatByTime(startDate, endDate, chainId) {
  // This would require time-based aggregation
  // For now, return placeholder data
  return [{
    period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
    volume: 0,
    transactions: 0,
    chainId: chainId ? parseInt(chainId) : null
  }];
}

function getChainName(chainId) {
  const chainNames = {
    1: 'ethereum',
    137: 'polygon',
    56: 'bsc'
  };
  return chainNames[chainId] || `chain-${chainId}`;
}

function calculateTotalVolume(volumeStats) {
  let totalVolume = 0;
  let totalTransactions = 0;

  volumeStats.forEach(chainData => {
    chainData.tokens.forEach(token => {
      totalVolume += token.volume;
    });
    totalTransactions += chainData.totalTransactions;
  });

  return { volume: totalVolume, transactions: totalTransactions };
}

module.exports = router;
