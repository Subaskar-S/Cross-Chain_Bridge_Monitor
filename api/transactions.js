const express = require('express');
const { TransactionOperations } = require('../db/operations');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/transactions - Get paginated transactions
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      chainId,
      status,
      tokenAddress,
      from,
      to,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      eventType,
      isMatched
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page

    const options = {
      page: pageNum,
      limit: limitNum,
      sortBy,
      sortOrder
    };

    // Add filters
    if (chainId) options.chainId = parseInt(chainId);
    if (status) options.status = status;
    if (tokenAddress) options.tokenAddress = tokenAddress;
    if (from) options.from = from;
    if (to) options.to = to;
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (eventType) options.eventType = eventType;
    if (isMatched !== undefined) options.isMatched = isMatched === 'true';

    const result = await TransactionOperations.getPaginated(options);

    res.json({
      success: true,
      data: result.transactions,
      pagination: result.pagination,
      filters: {
        chainId: options.chainId,
        status: options.status,
        tokenAddress: options.tokenAddress,
        from: options.from,
        to: options.to,
        startDate: options.startDate,
        endDate: options.endDate,
        eventType: options.eventType,
        isMatched: options.isMatched
      }
    });
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
});

// GET /api/transactions/:id - Get transaction by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await TransactionOperations.findById(id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction',
      message: error.message
    });
  }
});

// GET /api/transactions/hash/:hash - Get transaction by hash and chain
router.get('/hash/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const { chainId } = req.query;
    
    if (!chainId) {
      return res.status(400).json({
        success: false,
        error: 'chainId query parameter is required'
      });
    }

    const transaction = await TransactionOperations.findByHash(hash, parseInt(chainId));
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error('Error fetching transaction by hash:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction',
      message: error.message
    });
  }
});

// GET /api/transactions/bridge/:bridgeId - Get transactions by bridge ID
router.get('/bridge/:bridgeId', async (req, res) => {
  try {
    const { bridgeId } = req.params;
    
    const transactions = await TransactionOperations.findByBridgeId(bridgeId);
    
    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });
  } catch (error) {
    logger.error('Error fetching transactions by bridge ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
});

// GET /api/transactions/unmatched/:chainId - Get unmatched transactions for a chain
router.get('/unmatched/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const { maxAge = 3600000 } = req.query; // Default 1 hour
    
    const transactions = await TransactionOperations.findUnmatched(
      parseInt(chainId), 
      parseInt(maxAge)
    );
    
    res.json({
      success: true,
      data: transactions,
      count: transactions.length,
      chainId: parseInt(chainId),
      maxAge: parseInt(maxAge)
    });
  } catch (error) {
    logger.error('Error fetching unmatched transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unmatched transactions',
      message: error.message
    });
  }
});

// GET /api/transactions/stats/status - Get transaction status counts
router.get('/stats/status', async (req, res) => {
  try {
    const { chainId, timeRange } = req.query;
    
    const statusCounts = await TransactionOperations.getStatusCounts(
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
    logger.error('Error fetching transaction status counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction status counts',
      message: error.message
    });
  }
});

// PUT /api/transactions/:id/status - Update transaction status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const validStatuses = ['pending', 'completed', 'failed', 'timeout'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const transaction = await TransactionOperations.updateStatus(id, status);
    
    res.json({
      success: true,
      data: transaction,
      message: `Transaction status updated to ${status}`
    });
  } catch (error) {
    logger.error('Error updating transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update transaction status',
      message: error.message
    });
  }
});

// POST /api/transactions/:id/match - Manually match transactions
router.post('/:id/match', async (req, res) => {
  try {
    const { id } = req.params;
    const { targetTransactionId } = req.body;
    
    if (!targetTransactionId) {
      return res.status(400).json({
        success: false,
        error: 'targetTransactionId is required'
      });
    }

    const sourceTransaction = await TransactionOperations.findById(id);
    const targetTransaction = await TransactionOperations.findById(targetTransactionId);
    
    if (!sourceTransaction || !targetTransaction) {
      return res.status(404).json({
        success: false,
        error: 'One or both transactions not found'
      });
    }

    const result = await TransactionOperations.matchTransactions(
      sourceTransaction, 
      targetTransaction
    );
    
    res.json({
      success: true,
      data: result,
      message: 'Transactions matched successfully'
    });
  } catch (error) {
    logger.error('Error matching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to match transactions',
      message: error.message
    });
  }
});

// GET /api/transactions/search - Search transactions
router.get('/search', async (req, res) => {
  try {
    const {
      q,
      type = 'hash',
      chainId,
      limit = 20
    } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) is required'
      });
    }

    let results = [];
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    switch (type) {
      case 'hash':
        // Search by transaction hash
        if (chainId) {
          const transaction = await TransactionOperations.findByHash(q, parseInt(chainId));
          if (transaction) results = [transaction];
        } else {
          // Search across all chains
          const chains = [1, 137, 56];
          for (const chain of chains) {
            const transaction = await TransactionOperations.findByHash(q, chain);
            if (transaction) {
              results.push(transaction);
              break;
            }
          }
        }
        break;
        
      case 'address':
        // Search by from/to address
        const addressResults = await TransactionOperations.getPaginated({
          $or: [{ from: q }, { to: q }],
          chainId: chainId ? parseInt(chainId) : undefined,
          limit: limitNum
        });
        results = addressResults.transactions;
        break;
        
      case 'token':
        // Search by token address
        const tokenResults = await TransactionOperations.getPaginated({
          tokenAddress: q,
          chainId: chainId ? parseInt(chainId) : undefined,
          limit: limitNum
        });
        results = tokenResults.transactions;
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid search type. Must be: hash, address, or token'
        });
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      query: q,
      type,
      chainId: chainId ? parseInt(chainId) : null
    });
  } catch (error) {
    logger.error('Error searching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search transactions',
      message: error.message
    });
  }
});

module.exports = router;
