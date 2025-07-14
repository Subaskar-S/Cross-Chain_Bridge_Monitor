const express = require('express');
const { AnomalyOperations } = require('../db/operations');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/anomalies - Get paginated anomalies
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      severity,
      status,
      chainId,
      startDate,
      endDate,
      sortBy = 'detectedAt',
      sortOrder = 'desc'
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const options = {
      page: pageNum,
      limit: limitNum,
      sortBy,
      sortOrder
    };

    // Add filters
    if (type) options.type = type;
    if (severity) options.severity = severity;
    if (status) options.status = status;
    if (chainId) options.chainId = parseInt(chainId);
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    const result = await AnomalyOperations.getPaginated(options);

    res.json({
      success: true,
      data: result.anomalies,
      pagination: result.pagination,
      filters: {
        type: options.type,
        severity: options.severity,
        status: options.status,
        chainId: options.chainId,
        startDate: options.startDate,
        endDate: options.endDate
      }
    });
  } catch (error) {
    logger.error('Error fetching anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch anomalies',
      message: error.message
    });
  }
});

// GET /api/anomalies/:id - Get anomaly by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const anomaly = await AnomalyOperations.findById(id);
    
    if (!anomaly) {
      return res.status(404).json({
        success: false,
        error: 'Anomaly not found'
      });
    }

    res.json({
      success: true,
      data: anomaly
    });
  } catch (error) {
    logger.error('Error fetching anomaly:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch anomaly',
      message: error.message
    });
  }
});

// GET /api/anomalies/active/:chainId? - Get active anomalies
router.get('/active/:chainId?', async (req, res) => {
  try {
    const { chainId } = req.params;
    
    const anomalies = await AnomalyOperations.findActive(
      chainId ? parseInt(chainId) : null
    );
    
    res.json({
      success: true,
      data: anomalies,
      count: anomalies.length,
      chainId: chainId ? parseInt(chainId) : null
    });
  } catch (error) {
    logger.error('Error fetching active anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active anomalies',
      message: error.message
    });
  }
});

// GET /api/anomalies/severity/:severity - Get anomalies by severity
router.get('/severity/:severity', async (req, res) => {
  try {
    const { severity } = req.params;
    const { limit = 100 } = req.query;
    
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
      });
    }

    const anomalies = await AnomalyOperations.findBySeverity(
      severity, 
      Math.min(200, Math.max(1, parseInt(limit)))
    );
    
    res.json({
      success: true,
      data: anomalies,
      count: anomalies.length,
      severity
    });
  } catch (error) {
    logger.error('Error fetching anomalies by severity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch anomalies by severity',
      message: error.message
    });
  }
});

// GET /api/anomalies/stats/types - Get anomaly statistics by type
router.get('/stats/types', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const stats = await AnomalyOperations.getStatsByType(start, end);
    
    res.json({
      success: true,
      data: stats,
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching anomaly statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch anomaly statistics',
      message: error.message
    });
  }
});

// GET /api/anomalies/stats/status - Get anomaly status counts
router.get('/stats/status', async (req, res) => {
  try {
    const { chainId, timeRange } = req.query;
    
    const statusCounts = await AnomalyOperations.getStatusCounts(
      chainId ? parseInt(chainId) : null,
      timeRange ? parseInt(timeRange) : null
    );
    
    res.json({
      success: true,
      data: statusCounts,
      chainId: chainId ? parseInt(chainId) : null,
      timeRange: timeRange ? parseInt(timeRange) : null
    });
  } catch (error) {
    logger.error('Error fetching anomaly status counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch anomaly status counts',
      message: error.message
    });
  }
});

// PUT /api/anomalies/:id/resolve - Resolve an anomaly
router.put('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolvedBy, notes } = req.body;
    
    if (!resolvedBy) {
      return res.status(400).json({
        success: false,
        error: 'resolvedBy is required'
      });
    }

    const anomaly = await AnomalyOperations.resolve(id, resolvedBy, notes);
    
    res.json({
      success: true,
      data: anomaly,
      message: 'Anomaly resolved successfully'
    });
  } catch (error) {
    logger.error('Error resolving anomaly:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve anomaly',
      message: error.message
    });
  }
});

// PUT /api/anomalies/:id/false-positive - Mark anomaly as false positive
router.put('/:id/false-positive', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolvedBy, notes } = req.body;
    
    if (!resolvedBy) {
      return res.status(400).json({
        success: false,
        error: 'resolvedBy is required'
      });
    }

    const anomaly = await AnomalyOperations.markAsFalsePositive(id, resolvedBy, notes);
    
    res.json({
      success: true,
      data: anomaly,
      message: 'Anomaly marked as false positive'
    });
  } catch (error) {
    logger.error('Error marking anomaly as false positive:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark anomaly as false positive',
      message: error.message
    });
  }
});

// PUT /api/anomalies/:id/severity - Update anomaly severity
router.put('/:id/severity', async (req, res) => {
  try {
    const { id } = req.params;
    const { severity } = req.body;
    
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`
      });
    }

    const anomaly = await AnomalyOperations.updateSeverity(id, severity);
    
    res.json({
      success: true,
      data: anomaly,
      message: `Anomaly severity updated to ${severity}`
    });
  } catch (error) {
    logger.error('Error updating anomaly severity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update anomaly severity',
      message: error.message
    });
  }
});

// GET /api/anomalies/duplicates/:transactionHash - Find duplicate transaction anomalies
router.get('/duplicates/:transactionHash', async (req, res) => {
  try {
    const { transactionHash } = req.params;
    const { chainId, timeWindow = 86400000 } = req.query; // Default 24 hours
    
    if (!chainId) {
      return res.status(400).json({
        success: false,
        error: 'chainId query parameter is required'
      });
    }

    const duplicates = await AnomalyOperations.findDuplicates(
      transactionHash,
      parseInt(chainId),
      parseInt(timeWindow)
    );
    
    res.json({
      success: true,
      data: duplicates,
      count: duplicates.length,
      transactionHash,
      chainId: parseInt(chainId),
      timeWindow: parseInt(timeWindow)
    });
  } catch (error) {
    logger.error('Error finding duplicate anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find duplicate anomalies',
      message: error.message
    });
  }
});

// POST /api/anomalies/:id/alert - Add alert to anomaly
router.post('/:id/alert', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, status = 'sent', response, error } = req.body;
    
    if (!channel) {
      return res.status(400).json({
        success: false,
        error: 'channel is required'
      });
    }

    const validChannels = ['email', 'discord', 'slack', 'webhook', 'dashboard'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({
        success: false,
        error: `Invalid channel. Must be one of: ${validChannels.join(', ')}`
      });
    }

    const anomaly = await AnomalyOperations.addAlert(id, channel, status, response, error);
    
    res.json({
      success: true,
      data: anomaly,
      message: 'Alert added to anomaly'
    });
  } catch (error) {
    logger.error('Error adding alert to anomaly:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add alert to anomaly',
      message: error.message
    });
  }
});

// DELETE /api/anomalies/cleanup - Clean up old resolved anomalies
router.delete('/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 30 } = req.query;
    
    const deletedCount = await AnomalyOperations.deleteOldResolved(
      parseInt(olderThanDays)
    );
    
    res.json({
      success: true,
      deletedCount,
      olderThanDays: parseInt(olderThanDays),
      message: `Cleaned up ${deletedCount} old anomalies`
    });
  } catch (error) {
    logger.error('Error cleaning up anomalies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up anomalies',
      message: error.message
    });
  }
});

module.exports = router;
