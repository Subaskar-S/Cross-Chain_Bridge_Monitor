const express = require('express');
const { AlertOperations } = require('../db/operations');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/alerts - Get paginated alerts
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
      sortBy = 'createdAt',
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

    const result = await AlertOperations.getPaginated(options);

    res.json({
      success: true,
      data: result.alerts,
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
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
      message: error.message
    });
  }
});

// GET /api/alerts/:id - Get alert by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const alert = await AlertOperations.findById(id);
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert',
      message: error.message
    });
  }
});

// GET /api/alerts/pending - Get pending alerts
router.get('/pending', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const alerts = await AlertOperations.findPending(
      Math.min(200, Math.max(1, parseInt(limit)))
    );
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    logger.error('Error fetching pending alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending alerts',
      message: error.message
    });
  }
});

// GET /api/alerts/retry - Get alerts for retry
router.get('/retry', async (req, res) => {
  try {
    const alerts = await AlertOperations.findForRetry();
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    logger.error('Error fetching alerts for retry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts for retry',
      message: error.message
    });
  }
});

// GET /api/alerts/recent - Get recent alerts
router.get('/recent', async (req, res) => {
  try {
    const { limit = 20, severity } = req.query;
    
    const alerts = await AlertOperations.getRecentAlerts(
      Math.min(100, Math.max(1, parseInt(limit))),
      severity
    );
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      severity: severity || null
    });
  } catch (error) {
    logger.error('Error fetching recent alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent alerts',
      message: error.message
    });
  }
});

// GET /api/alerts/stats/status - Get alert status statistics
router.get('/stats/status', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const stats = await AlertOperations.getStatsByStatus(start, end);
    
    res.json({
      success: true,
      data: stats,
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching alert statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert statistics',
      message: error.message
    });
  }
});

// GET /api/alerts/stats/counts - Get alert counts by status
router.get('/stats/counts', async (req, res) => {
  try {
    const { chainId, timeRange } = req.query;
    
    const statusCounts = await AlertOperations.getStatusCounts(
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
    logger.error('Error fetching alert status counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert status counts',
      message: error.message
    });
  }
});

// PUT /api/alerts/:id/acknowledge - Acknowledge an alert
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy, notes } = req.body;
    
    if (!acknowledgedBy) {
      return res.status(400).json({
        success: false,
        error: 'acknowledgedBy is required'
      });
    }

    const alert = await AlertOperations.acknowledge(id, acknowledgedBy, notes);
    
    res.json({
      success: true,
      data: alert,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      message: error.message
    });
  }
});

// PUT /api/alerts/:id/resolve - Resolve an alert
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

    const alert = await AlertOperations.resolve(id, resolvedBy, notes);
    
    res.json({
      success: true,
      data: alert,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
      message: error.message
    });
  }
});

// POST /api/alerts/:id/note - Add note to alert
router.post('/:id/note', async (req, res) => {
  try {
    const { id } = req.params;
    const { author, content } = req.body;
    
    if (!author || !content) {
      return res.status(400).json({
        success: false,
        error: 'author and content are required'
      });
    }

    const alert = await AlertOperations.addNote(id, author, content);
    
    res.json({
      success: true,
      data: alert,
      message: 'Note added to alert'
    });
  } catch (error) {
    logger.error('Error adding note to alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add note to alert',
      message: error.message
    });
  }
});

// PUT /api/alerts/:id/sent - Mark alert as sent
router.put('/:id/sent', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel } = req.body;
    
    if (!channel) {
      return res.status(400).json({
        success: false,
        error: 'channel is required'
      });
    }

    const alert = await AlertOperations.markAsSent(id, channel);
    
    res.json({
      success: true,
      data: alert,
      message: `Alert marked as sent via ${channel}`
    });
  } catch (error) {
    logger.error('Error marking alert as sent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark alert as sent',
      message: error.message
    });
  }
});

// PUT /api/alerts/:id/failed - Mark alert as failed
router.put('/:id/failed', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel, error: errorMessage } = req.body;
    
    if (!channel) {
      return res.status(400).json({
        success: false,
        error: 'channel is required'
      });
    }

    const alert = await AlertOperations.markAsFailed(id, channel, errorMessage);
    
    res.json({
      success: true,
      data: alert,
      message: `Alert marked as failed for ${channel}`
    });
  } catch (error) {
    logger.error('Error marking alert as failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark alert as failed',
      message: error.message
    });
  }
});

// GET /api/alerts/group/:groupKey - Get alerts by group key
router.get('/group/:groupKey', async (req, res) => {
  try {
    const { groupKey } = req.params;
    const { timeWindow = 60000 } = req.query; // Default 1 minute
    
    const alerts = await AlertOperations.findByGroupKey(
      groupKey,
      parseInt(timeWindow)
    );
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      groupKey,
      timeWindow: parseInt(timeWindow)
    });
  } catch (error) {
    logger.error('Error fetching alerts by group key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts by group key',
      message: error.message
    });
  }
});

// DELETE /api/alerts/cleanup - Clean up old resolved alerts
router.delete('/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 7 } = req.query;
    
    const deletedCount = await AlertOperations.deleteOldResolved(
      parseInt(olderThanDays)
    );
    
    res.json({
      success: true,
      deletedCount,
      olderThanDays: parseInt(olderThanDays),
      message: `Cleaned up ${deletedCount} old alerts`
    });
  } catch (error) {
    logger.error('Error cleaning up alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up alerts',
      message: error.message
    });
  }
});

// POST /api/alerts/auto-resolve - Auto-resolve expired alerts
router.post('/auto-resolve', async (req, res) => {
  try {
    const resolvedCount = await AlertOperations.autoResolveExpired();
    
    res.json({
      success: true,
      resolvedCount,
      message: `Auto-resolved ${resolvedCount} expired alerts`
    });
  } catch (error) {
    logger.error('Error auto-resolving alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-resolve alerts',
      message: error.message
    });
  }
});

module.exports = router;
