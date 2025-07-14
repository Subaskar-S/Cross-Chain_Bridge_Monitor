const logger = require('../../utils/logger');

class RateLimiter {
  constructor() {
    this.requests = new Map(); // Store request counts per IP/API key
    this.cleanupInterval = null;
    
    // Start cleanup interval to remove old entries
    this.startCleanup();
  }

  // Create rate limiting middleware
  createLimiter(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      maxRequests = 100,
      keyGenerator = (req) => req.ip || 'unknown',
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      message = 'Too many requests, please try again later'
    } = options;

    return (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get or create request history for this key
      if (!this.requests.has(key)) {
        this.requests.set(key, []);
      }

      const requestHistory = this.requests.get(key);
      
      // Remove old requests outside the window
      const recentRequests = requestHistory.filter(timestamp => timestamp > windowStart);
      this.requests.set(key, recentRequests);

      // Check if limit exceeded
      if (recentRequests.length >= maxRequests) {
        logger.warn(`Rate limit exceeded for ${key}: ${recentRequests.length} requests in window`);
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message,
          retryAfter: Math.ceil(windowMs / 1000),
          limit: maxRequests,
          remaining: 0,
          resetTime: new Date(now + windowMs).toISOString()
        });
      }

      // Add current request to history
      recentRequests.push(now);
      this.requests.set(key, recentRequests);

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - recentRequests.length),
        'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
      });

      // Handle response to potentially skip counting
      const originalSend = res.send;
      res.send = function(body) {
        const shouldSkip = 
          (skipSuccessfulRequests && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400);

        if (shouldSkip) {
          // Remove the request we just added
          const currentHistory = rateLimiter.requests.get(key) || [];
          currentHistory.pop();
          rateLimiter.requests.set(key, currentHistory);
        }

        return originalSend.call(this, body);
      };

      next();
    };
  }

  // Different rate limits for different endpoints
  getStandardLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      keyGenerator: (req) => req.apiKey || req.ip || 'unknown'
    });
  }

  getStrictLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 20,
      keyGenerator: (req) => req.apiKey || req.ip || 'unknown',
      message: 'Too many requests to this endpoint, please try again later'
    });
  }

  getPublicLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50,
      keyGenerator: (req) => req.ip || 'unknown',
      message: 'Too many requests from this IP, please try again later'
    });
  }

  getAuthenticatedLimiter() {
    return this.createLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 500, // Higher limit for authenticated users
      keyGenerator: (req) => req.apiKey || req.ip || 'unknown'
    });
  }

  // Start cleanup interval
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  // Clean up old entries
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const [key, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(timestamp => now - timestamp < maxAge);
      
      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentRequests);
      }
    }
    
    logger.debug(`Rate limiter cleanup completed. Active keys: ${this.requests.size}`);
  }

  // Get current statistics
  getStats() {
    const stats = {
      totalKeys: this.requests.size,
      keyBreakdown: {}
    };

    for (const [key, requests] of this.requests.entries()) {
      stats.keyBreakdown[key] = requests.length;
    }

    return stats;
  }

  // Reset rate limits for a specific key (admin function)
  resetKey(key) {
    const deleted = this.requests.delete(key);
    if (deleted) {
      logger.info(`Rate limit reset for key: ${key}`);
    }
    return deleted;
  }

  // Stop cleanup interval
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

module.exports = {
  rateLimiter,
  standardLimit: rateLimiter.getStandardLimiter(),
  strictLimit: rateLimiter.getStrictLimiter(),
  publicLimit: rateLimiter.getPublicLimiter(),
  authenticatedLimit: rateLimiter.getAuthenticatedLimiter()
};
