module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },

  // Database Configuration
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-monitor',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    }
  },

  // Blockchain Network Configuration
  networks: {
    ethereum: {
      name: 'Ethereum',
      chainId: 1,
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
      wsUrl: process.env.ETHEREUM_WS_URL || 'wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID',
      bridgeContract: process.env.ETHEREUM_BRIDGE_CONTRACT || '0x...',
      startBlock: process.env.ETHEREUM_START_BLOCK || 'latest'
    },
    polygon: {
      name: 'Polygon',
      chainId: 137,
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID',
      wsUrl: process.env.POLYGON_WS_URL || 'wss://polygon-mainnet.infura.io/ws/v3/YOUR_PROJECT_ID',
      bridgeContract: process.env.POLYGON_BRIDGE_CONTRACT || '0x...',
      startBlock: process.env.POLYGON_START_BLOCK || 'latest'
    },
    bsc: {
      name: 'BSC',
      chainId: 56,
      rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
      wsUrl: process.env.BSC_WS_URL || 'wss://bsc-ws-node.nariox.org:443',
      bridgeContract: process.env.BSC_BRIDGE_CONTRACT || '0x...',
      startBlock: process.env.BSC_START_BLOCK || 'latest'
    }
  },

  // Alert Configuration
  alerts: {
    timeoutWindow: 30 * 60 * 1000, // 30 minutes in milliseconds
    maxRetries: 3,
    webhooks: {
      discord: process.env.DISCORD_WEBHOOK_URL,
      slack: process.env.SLACK_WEBHOOK_URL
    },
    email: {
      smtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      from: process.env.EMAIL_FROM || 'alerts@bridge-monitor.com',
      to: process.env.EMAIL_TO || 'admin@bridge-monitor.com'
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/bridge-monitor.log'
  },

  // Anomaly Detection Rules
  anomalyRules: {
    bridgeTimeout: {
      enabled: true,
      timeoutMs: 30 * 60 * 1000 // 30 minutes
    },
    valueMismatch: {
      enabled: true,
      tolerancePercent: 0.1 // 0.1% tolerance
    },
    duplicateTransaction: {
      enabled: true,
      windowMs: 24 * 60 * 60 * 1000 // 24 hours
    },
    suspiciousContract: {
      enabled: true,
      blacklist: [] // Add known scam contract addresses
    }
  }
};
