# Production Deployment Guide

This guide covers the essential changes needed to deploy the Cross-Chain Bridge Monitoring System in a production environment.

## Critical Production Changes

### 1. **Database Configuration** 🗄️

#### **Replace Mock Database with Real MongoDB**

**Current (Demo):**
```javascript
// Uses mock in-memory database
DEMO_MODE=true
```

**Production Required:**
```bash
# Environment Variables
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/bridge-monitor
# OR for self-hosted
MONGODB_URI=mongodb://username:password@your-server:27017/bridge-monitor

# Disable demo mode
DEMO_MODE=false
ENABLE_LISTENERS=true
ENABLE_ALERTS=true
```

**MongoDB Setup Options:**
- **MongoDB Atlas** (Recommended): Free tier available
- **Self-hosted MongoDB**: On your server
- **Docker MongoDB**: Using docker-compose

### 2. **Blockchain RPC Configuration** ⛓️

#### **Replace Public RPC with Dedicated Endpoints**

**Current (Demo):**
```bash
ETHEREUM_RPC_URL=https://eth.llamarpc.com  # Rate limited
POLYGON_RPC_URL=https://polygon.llamarpc.com  # Rate limited
BSC_RPC_URL=https://bsc-dataseed.binance.org/  # Rate limited
```

**Production Required:**
```bash
# Dedicated RPC providers (Choose one or multiple)
# Infura (Recommended)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
POLYGON_WS_URL=wss://polygon-mainnet.infura.io/ws/v3/YOUR_PROJECT_ID

# Alchemy (Alternative)
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# QuickNode (Alternative)
BSC_RPC_URL=https://your-endpoint.bsc.quiknode.pro/YOUR_TOKEN/
```

### 3. **Real Bridge Contract Addresses** 📄

#### **Replace Demo Addresses with Actual Contracts**

**Current (Demo):**
```bash
ETHEREUM_BRIDGE_CONTRACT=0x1234567890123456789012345678901234567890
POLYGON_BRIDGE_CONTRACT=0x1234567890123456789012345678901234567890
BSC_BRIDGE_CONTRACT=0x1234567890123456789012345678901234567890
```

**Production Required:**
```bash
# Real bridge contract addresses (Examples)
ETHEREUM_BRIDGE_CONTRACT=0xa0b86a33e6776e681c6c6b6b6b6b6b6b6b6b6b6b
POLYGON_BRIDGE_CONTRACT=0xb1c97a44f6776e681c6c6b6b6b6b6b6b6b6b6b6b
BSC_BRIDGE_CONTRACT=0xc2d08b55f6776e681c6c6b6b6b6b6b6b6b6b6b6b

# Contract ABI files (store in contracts/ directory)
ETHEREUM_BRIDGE_ABI_PATH=./contracts/ethereum-bridge-abi.json
POLYGON_BRIDGE_ABI_PATH=./contracts/polygon-bridge-abi.json
BSC_BRIDGE_ABI_PATH=./contracts/bsc-bridge-abi.json
```

### 4. **Alert System Configuration** 🚨

#### **Configure Real Alert Channels**

**Current (Demo):**
```bash
# No real alerts sent
ENABLE_ALERTS=false
```

**Production Required:**
```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
ALERT_EMAIL_FROM=alerts@your-domain.com
ALERT_EMAIL_TO=admin@your-domain.com,security@your-domain.com

# Discord Webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# Slack Webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Custom Webhooks
CUSTOM_WEBHOOK_URL=https://your-monitoring-system.com/webhook
WEBHOOK_SECRET=your-webhook-secret

# Alert Configuration
ENABLE_ALERTS=true
ALERT_RATE_LIMIT=10  # Max alerts per minute
ALERT_COOLDOWN=300   # 5 minutes between duplicate alerts
```

### 5. **Security Configuration** 🔒

#### **API Authentication & Rate Limiting**

**Current (Demo):**
```bash
API_KEYS=demo-key-123,test-key-456
```

**Production Required:**
```bash
# Strong API Keys (generate with crypto.randomBytes)
API_KEYS=sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6,sk_live_q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # per window
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com
CORS_CREDENTIALS=true
```

### 6. **Monitoring & Logging** 📊

#### **Production Logging & Monitoring**

**Current (Demo):**
```bash
LOG_LEVEL=info
```

**Production Required:**
```bash
# Logging Configuration
LOG_LEVEL=warn
LOG_FILE=logs/bridge-monitor.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
LOG_DATE_PATTERN=YYYY-MM-DD

# Monitoring
HEALTH_CHECK_INTERVAL=30000  # 30 seconds
METRICS_ENABLED=true
METRICS_PORT=9090

# Error Tracking (Sentry)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production

# Performance Monitoring
APM_ENABLED=true
APM_SERVICE_NAME=bridge-monitor
```

### 7. **Performance Optimization** ⚡

#### **Production Performance Settings**

```bash
# Node.js Optimization
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=2048

# Database Connection Pool
DB_POOL_SIZE=10
DB_TIMEOUT=30000

# Cache Configuration
REDIS_URL=redis://localhost:6379
CACHE_TTL=300  # 5 minutes

# WebSocket Configuration
WS_MAX_CONNECTIONS=1000
WS_HEARTBEAT_INTERVAL=30000
```

## 🏗️ **INFRASTRUCTURE REQUIREMENTS**

### **Minimum Server Requirements**
- **CPU**: 2 vCPUs
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 100 Mbps

### **Recommended Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│  App Servers    │────│    Database     │
│  (Nginx/HAProxy)│    │  (Node.js x2)   │    │   (MongoDB)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│     Redis       │──────────────┘
                        │    (Cache)      │
                        └─────────────────┘
```

## 📋 **PRODUCTION CHECKLIST**

### **Before Deployment**
- [ ] Set up MongoDB cluster with backups
- [ ] Obtain dedicated RPC endpoints
- [ ] Configure real bridge contract addresses
- [ ] Set up email/Discord/Slack for alerts
- [ ] Generate strong API keys and JWT secrets
- [ ] Configure SSL certificates
- [ ] Set up monitoring and logging
- [ ] Test all alert channels
- [ ] Perform load testing
- [ ] Set up backup and recovery procedures

### **Security Checklist**
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up VPN access for admin
- [ ] Enable database authentication
- [ ] Rotate API keys regularly
- [ ] Set up intrusion detection
- [ ] Configure rate limiting
- [ ] Enable audit logging

### **Monitoring Checklist**
- [ ] Set up uptime monitoring
- [ ] Configure error alerting
- [ ] Monitor database performance
- [ ] Track API response times
- [ ] Monitor blockchain connection health
- [ ] Set up log aggregation
- [ ] Configure performance metrics
- [ ] Set up automated backups

## 🚀 **DEPLOYMENT SCRIPTS**

### **Production Environment Setup**
```bash
#!/bin/bash
# production-setup.sh

# Install dependencies
npm ci --only=production

# Build frontend
cd dashboard && npm ci --only=production && npm run build && cd ..

# Set up database
node scripts/setup-production-db.js

# Start with PM2 (Process Manager)
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### **PM2 Configuration** (ecosystem.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'bridge-monitor',
    script: 'index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

## 🔧 **CONFIGURATION FILES**

### **Production Environment File** (.env.production)
```bash
# Copy this to .env for production
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/bridge-monitor

# Blockchain RPC
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID
POLYGON_RPC_URL=https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID
POLYGON_WS_URL=wss://polygon-mainnet.infura.io/ws/v3/YOUR_PROJECT_ID
BSC_RPC_URL=https://bsc-dataseed.binance.org/

# Real Contract Addresses
ETHEREUM_BRIDGE_CONTRACT=0xYOUR_REAL_CONTRACT_ADDRESS
POLYGON_BRIDGE_CONTRACT=0xYOUR_REAL_CONTRACT_ADDRESS
BSC_BRIDGE_CONTRACT=0xYOUR_REAL_CONTRACT_ADDRESS

# Security
API_KEYS=sk_live_your_production_api_key
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Alerts
ENABLE_ALERTS=true
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK

# Monitoring
LOG_LEVEL=warn
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## 💰 **COST ESTIMATION**

### **Monthly Costs (USD)**
- **MongoDB Atlas**: $0-9 (Free tier - Shared cluster)
- **Infura RPC**: $0-50 (Free tier - 100k requests/day)
- **Server (VPS)**: $5-20 (DigitalOcean, Linode)
- **Domain & SSL**: $10-15/year
- **Monitoring**: $0-29 (Free tiers available)

**Total**: ~$15-100/month depending on usage

## 🆘 **SUPPORT & MAINTENANCE**

### **Regular Maintenance Tasks**
- Monitor system health daily
- Update dependencies monthly
- Rotate API keys quarterly
- Review logs weekly
- Test backup recovery monthly
- Update documentation as needed

### **Emergency Procedures**
- Database failover process
- RPC endpoint switching
- Alert system testing
- Incident response plan
- Recovery procedures

---

**⚠️ IMPORTANT**: Never deploy to production without implementing these security and monitoring measures. The demo version is NOT suitable for production use without these modifications.
