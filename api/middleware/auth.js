const logger = require('../../utils/logger');

// Simple API key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  // In production, this would check against a database of valid API keys
  const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : ['dev-key-123'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      message: 'Please provide an API key in the x-api-key header or apiKey query parameter'
    });
  }
  
  if (!validApiKeys.includes(apiKey)) {
    logger.warn(`Invalid API key attempted: ${apiKey}`);
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }
  
  // Add API key info to request for logging
  req.apiKey = apiKey;
  next();
};

// Optional authentication (allows both authenticated and unauthenticated requests)
const optionalAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (apiKey) {
    const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : ['dev-key-123'];
    
    if (validApiKeys.includes(apiKey)) {
      req.apiKey = apiKey;
      req.isAuthenticated = true;
    } else {
      req.isAuthenticated = false;
    }
  } else {
    req.isAuthenticated = false;
  }
  
  next();
};

module.exports = {
  authenticateApiKey,
  optionalAuth
};
