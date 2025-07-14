const mongoose = require('mongoose');

const AnomalySchema = new mongoose.Schema({
  // Anomaly identification
  anomalyId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Anomaly type and severity
  type: {
    type: String,
    required: true,
    enum: [
      'bridge_timeout',
      'value_mismatch', 
      'duplicate_transaction',
      'suspicious_contract',
      'unusual_volume',
      'failed_verification',
      'replay_attack',
      'gas_anomaly'
    ],
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  
  // Status tracking
  status: {
    type: String,
    required: true,
    enum: ['active', 'investigating', 'resolved', 'false_positive'],
    default: 'active',
    index: true
  },
  
  // Related transaction information
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    index: true
  },
  relatedTransactionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  
  // Network and contract information
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
  contractAddress: {
    type: String,
    index: true
  },
  
  // Anomaly details
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // Specific anomaly data
  anomalyData: {
    // For bridge_timeout
    timeoutDuration: Number,
    expectedCompletionTime: Date,
    
    // For value_mismatch
    expectedValue: String,
    actualValue: String,
    discrepancyPercent: Number,
    
    // For duplicate_transaction
    originalTransactionHash: String,
    duplicateTransactionHash: String,
    timeBetweenDuplicates: Number,
    
    // For suspicious_contract
    contractAddress: String,
    riskScore: Number,
    blacklistReason: String,
    
    // For unusual_volume
    volumeAmount: String,
    averageVolume: String,
    volumeMultiplier: Number,
    timeWindow: String,
    
    // Generic fields
    additionalData: mongoose.Schema.Types.Mixed
  },
  
  // Detection information
  detectedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  detectionRule: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  },
  
  // Resolution information
  resolvedAt: {
    type: Date,
    index: true
  },
  resolvedBy: {
    type: String // User ID or system identifier
  },
  resolutionNotes: {
    type: String
  },
  
  // Alert information
  alertsSent: [{
    channel: {
      type: String,
      enum: ['email', 'discord', 'slack', 'webhook', 'dashboard']
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending'],
      default: 'sent'
    },
    response: String,
    error: String
  }],
  
  // Metadata
  tags: [String],
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  
  // Auto-resolution settings
  autoResolve: {
    type: Boolean,
    default: false
  },
  autoResolveAfter: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'anomalies'
});

// Indexes for efficient queries
AnomalySchema.index({ type: 1, detectedAt: -1 });
AnomalySchema.index({ severity: 1, status: 1, detectedAt: -1 });
AnomalySchema.index({ chainId: 1, detectedAt: -1 });
AnomalySchema.index({ status: 1, detectedAt: -1 });
AnomalySchema.index({ contractAddress: 1, detectedAt: -1 });

// Methods
AnomalySchema.methods.resolve = function(resolvedBy, notes) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  this.resolutionNotes = notes;
  return this.save();
};

AnomalySchema.methods.markAsFalsePositive = function(resolvedBy, notes) {
  this.status = 'false_positive';
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  this.resolutionNotes = notes;
  return this.save();
};

AnomalySchema.methods.addAlert = function(channel, status = 'sent', response = null, error = null) {
  this.alertsSent.push({
    channel,
    status,
    response,
    error,
    sentAt: new Date()
  });
  return this.save();
};

AnomalySchema.methods.updateSeverity = function(newSeverity) {
  this.severity = newSeverity;
  return this.save();
};

// Static methods
AnomalySchema.statics.findActive = function(chainId = null) {
  const query = { status: 'active' };
  if (chainId) query.chainId = chainId;
  return this.find(query).sort({ detectedAt: -1 });
};

AnomalySchema.statics.findBySeverity = function(severity, limit = 100) {
  return this.find({ severity, status: 'active' })
    .sort({ detectedAt: -1 })
    .limit(limit);
};

AnomalySchema.statics.getStatsByType = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        detectedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          severity: '$severity',
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        severityBreakdown: {
          $push: {
            severity: '$_id.severity',
            status: '$_id.status',
            count: '$count'
          }
        },
        totalCount: { $sum: '$count' }
      }
    }
  ]);
};

AnomalySchema.statics.findDuplicates = function(transactionHash, chainId, timeWindow = 24 * 60 * 60 * 1000) {
  const cutoffTime = new Date(Date.now() - timeWindow);
  return this.find({
    type: 'duplicate_transaction',
    chainId,
    $or: [
      { 'anomalyData.originalTransactionHash': transactionHash },
      { 'anomalyData.duplicateTransactionHash': transactionHash }
    ],
    detectedAt: { $gte: cutoffTime }
  });
};

// Pre-save middleware to generate anomalyId
AnomalySchema.pre('save', function(next) {
  if (!this.anomalyId) {
    this.anomalyId = `${this.type}_${this.chainId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model('Anomaly', AnomalySchema);
