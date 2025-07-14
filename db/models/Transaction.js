const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  // Transaction identifiers
  txHash: {
    type: String,
    required: true,
    index: true
  },
  blockNumber: {
    type: Number,
    required: true,
    index: true
  },
  blockHash: {
    type: String,
    required: true
  },
  transactionIndex: {
    type: Number,
    required: true
  },
  logIndex: {
    type: Number,
    required: true
  },

  // Network information
  chainId: {
    type: Number,
    required: true,
    index: true
  },
  networkName: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'bsc']
  },

  // Bridge transaction details
  eventType: {
    type: String,
    required: true,
    enum: ['Lock', 'Unlock', 'Mint', 'Burn', 'Transfer', 'BridgeSwap']
  },
  bridgeContract: {
    type: String,
    required: true,
    index: true
  },
  
  // Token information
  tokenAddress: {
    type: String,
    required: true,
    index: true
  },
  tokenSymbol: {
    type: String,
    required: true
  },
  tokenDecimals: {
    type: Number,
    required: true
  },
  amount: {
    type: String, // Use string to handle large numbers
    required: true
  },
  amountFormatted: {
    type: Number,
    required: true
  },

  // Address information
  from: {
    type: String,
    required: true,
    index: true
  },
  to: {
    type: String,
    required: true,
    index: true
  },
  recipient: {
    type: String,
    index: true
  },

  // Cross-chain information
  targetChainId: {
    type: Number,
    index: true
  },
  targetNetworkName: {
    type: String,
    enum: ['ethereum', 'polygon', 'bsc']
  },
  bridgeId: {
    type: String,
    index: true // Used to match cross-chain transactions
  },
  nonce: {
    type: String,
    index: true
  },

  // Transaction status
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed', 'timeout'],
    default: 'pending',
    index: true
  },
  
  // Timing information
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  gasUsed: {
    type: String
  },
  gasPrice: {
    type: String
  },
  transactionFee: {
    type: String
  },

  // Matching information for cross-chain verification
  matchedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    index: true
  },
  isMatched: {
    type: Boolean,
    default: false,
    index: true
  },
  matchedAt: {
    type: Date
  },

  // Raw event data for debugging
  rawEventData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Processing metadata
  processedAt: {
    type: Date,
    default: Date.now
  },
  retryCount: {
    type: Number,
    default: 0
  },
  lastRetryAt: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'transactions'
});

// Compound indexes for efficient queries
TransactionSchema.index({ chainId: 1, timestamp: -1 });
TransactionSchema.index({ bridgeId: 1, chainId: 1 });
TransactionSchema.index({ from: 1, timestamp: -1 });
TransactionSchema.index({ to: 1, timestamp: -1 });
TransactionSchema.index({ status: 1, timestamp: -1 });
TransactionSchema.index({ tokenAddress: 1, timestamp: -1 });
TransactionSchema.index({ eventType: 1, chainId: 1, timestamp: -1 });

// Unique constraint to prevent duplicate events
TransactionSchema.index({ 
  txHash: 1, 
  logIndex: 1, 
  chainId: 1 
}, { unique: true });

// Methods
TransactionSchema.methods.markAsMatched = function(matchedTransactionId) {
  this.isMatched = true;
  this.matchedTransactionId = matchedTransactionId;
  this.matchedAt = new Date();
  this.status = 'completed';
  return this.save();
};

TransactionSchema.methods.markAsTimeout = function() {
  this.status = 'timeout';
  return this.save();
};

// Static methods
TransactionSchema.statics.findUnmatched = function(chainId, maxAge) {
  const cutoffTime = new Date(Date.now() - maxAge);
  return this.find({
    chainId,
    isMatched: false,
    status: 'pending',
    timestamp: { $gte: cutoffTime }
  });
};

TransactionSchema.statics.findByBridgeId = function(bridgeId) {
  return this.find({ bridgeId }).sort({ timestamp: 1 });
};

TransactionSchema.statics.getVolumeStats = function(startDate, endDate, chainId) {
  const match = {
    timestamp: { $gte: startDate, $lte: endDate },
    status: 'completed'
  };
  
  if (chainId) {
    match.chainId = chainId;
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          chainId: '$chainId',
          tokenAddress: '$tokenAddress',
          tokenSymbol: '$tokenSymbol'
        },
        totalVolume: { $sum: '$amountFormatted' },
        transactionCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.chainId',
        tokens: {
          $push: {
            address: '$_id.tokenAddress',
            symbol: '$_id.tokenSymbol',
            volume: '$totalVolume',
            count: '$transactionCount'
          }
        },
        totalTransactions: { $sum: '$transactionCount' }
      }
    }
  ]);
};

module.exports = mongoose.model('Transaction', TransactionSchema);
