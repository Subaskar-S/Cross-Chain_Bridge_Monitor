const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  // Alert identification
  alertId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Alert type and classification
  type: {
    type: String,
    required: true,
    enum: [
      'anomaly_detected',
      'system_error',
      'network_issue',
      'high_volume',
      'bridge_down',
      'threshold_exceeded',
      'manual_alert'
    ],
    index: true
  },
  
  // Alert severity and priority
  severity: {
    type: String,
    required: true,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
    index: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5,
    index: true
  },
  
  // Alert content
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Related entities
  anomalyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Anomaly',
    index: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    index: true
  },
  
  // Network context
  chainId: {
    type: Number,
    index: true
  },
  networkName: {
    type: String,
    enum: ['ethereum', 'polygon', 'bsc']
  },
  contractAddress: {
    type: String,
    index: true
  },
  
  // Alert status
  status: {
    type: String,
    required: true,
    enum: ['pending', 'sent', 'acknowledged', 'resolved', 'failed'],
    default: 'pending',
    index: true
  },
  
  // Timing information
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  scheduledFor: {
    type: Date,
    index: true
  },
  sentAt: {
    type: Date,
    index: true
  },
  acknowledgedAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  },
  
  // Delivery channels and status
  channels: [{
    type: {
      type: String,
      enum: ['email', 'discord', 'slack', 'webhook', 'dashboard', 'sms'],
      required: true
    },
    target: {
      type: String, // email address, webhook URL, etc.
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'bounced'],
      default: 'pending'
    },
    sentAt: Date,
    deliveredAt: Date,
    attempts: {
      type: Number,
      default: 0
    },
    lastAttemptAt: Date,
    error: String,
    response: mongoose.Schema.Types.Mixed
  }],
  
  // Retry configuration
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  nextRetryAt: {
    type: Date
  },
  
  // Grouping and deduplication
  groupKey: {
    type: String,
    index: true
  },
  isDuplicate: {
    type: Boolean,
    default: false
  },
  originalAlertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert'
  },
  duplicateCount: {
    type: Number,
    default: 0
  },
  
  // User interaction
  acknowledgedBy: {
    type: String // User ID or system identifier
  },
  resolvedBy: {
    type: String
  },
  notes: [{
    author: String,
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  tags: [String],
  source: {
    type: String,
    default: 'system'
  },
  
  // Auto-resolution
  autoResolve: {
    type: Boolean,
    default: false
  },
  autoResolveAfter: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'alerts'
});

// Indexes for efficient queries
AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ severity: 1, status: 1, createdAt: -1 });
AlertSchema.index({ type: 1, createdAt: -1 });
AlertSchema.index({ chainId: 1, createdAt: -1 });
AlertSchema.index({ groupKey: 1, createdAt: -1 });
AlertSchema.index({ scheduledFor: 1, status: 1 });

// Methods
AlertSchema.methods.acknowledge = function(acknowledgedBy, notes) {
  this.status = 'acknowledged';
  this.acknowledgedAt = new Date();
  this.acknowledgedBy = acknowledgedBy;
  if (notes) {
    this.notes.push({
      author: acknowledgedBy,
      content: notes,
      timestamp: new Date()
    });
  }
  return this.save();
};

AlertSchema.methods.resolve = function(resolvedBy, notes) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  if (notes) {
    this.notes.push({
      author: resolvedBy,
      content: notes,
      timestamp: new Date()
    });
  }
  return this.save();
};

AlertSchema.methods.markAsSent = function(channel) {
  this.status = 'sent';
  this.sentAt = new Date();
  
  // Update specific channel status
  const channelIndex = this.channels.findIndex(c => c.type === channel);
  if (channelIndex !== -1) {
    this.channels[channelIndex].status = 'sent';
    this.channels[channelIndex].sentAt = new Date();
  }
  
  return this.save();
};

AlertSchema.methods.markAsFailed = function(channel, error) {
  this.status = 'failed';
  this.retryCount += 1;
  
  // Update specific channel status
  const channelIndex = this.channels.findIndex(c => c.type === channel);
  if (channelIndex !== -1) {
    this.channels[channelIndex].status = 'failed';
    this.channels[channelIndex].error = error;
    this.channels[channelIndex].attempts += 1;
    this.channels[channelIndex].lastAttemptAt = new Date();
  }
  
  // Schedule retry if under max retries
  if (this.retryCount < this.maxRetries) {
    this.nextRetryAt = new Date(Date.now() + (this.retryCount * 60000)); // Exponential backoff
    this.status = 'pending';
  }
  
  return this.save();
};

AlertSchema.methods.addNote = function(author, content) {
  this.notes.push({
    author,
    content,
    timestamp: new Date()
  });
  return this.save();
};

// Static methods
AlertSchema.statics.findPending = function(limit = 100) {
  return this.find({ 
    status: 'pending',
    $or: [
      { scheduledFor: { $lte: new Date() } },
      { scheduledFor: { $exists: false } }
    ]
  })
  .sort({ priority: -1, createdAt: 1 })
  .limit(limit);
};

AlertSchema.statics.findForRetry = function() {
  return this.find({
    status: 'pending',
    nextRetryAt: { $lte: new Date() },
    retryCount: { $lt: this.maxRetries }
  })
  .sort({ nextRetryAt: 1 });
};

AlertSchema.statics.findByGroupKey = function(groupKey, timeWindow = 60000) {
  const cutoffTime = new Date(Date.now() - timeWindow);
  return this.find({
    groupKey,
    createdAt: { $gte: cutoffTime }
  }).sort({ createdAt: -1 });
};

AlertSchema.statics.getStatsByStatus = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          status: '$status',
          severity: '$severity',
          type: '$type'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.status',
        breakdown: {
          $push: {
            severity: '$_id.severity',
            type: '$_id.type',
            count: '$count'
          }
        },
        totalCount: { $sum: '$count' }
      }
    }
  ]);
};

// Pre-save middleware to generate alertId and groupKey
AlertSchema.pre('save', function(next) {
  if (!this.alertId) {
    this.alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (!this.groupKey) {
    // Generate group key for deduplication
    this.groupKey = `${this.type}_${this.chainId || 'global'}_${this.contractAddress || 'none'}`;
  }
  
  next();
});

module.exports = mongoose.model('Alert', AlertSchema);
