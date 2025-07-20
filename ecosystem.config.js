/**
 * PM2 Ecosystem Configuration for Bridge Monitor
 * This file configures PM2 process manager for production deployment
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 start ecosystem.config.js --env development
 */

module.exports = {
  apps: [
    {
      // Main Application
      name: 'bridge-monitor',
      script: 'scripts/production-start.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      
      // Environment Configuration
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DEMO_MODE: 'true'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DEMO_MODE: 'false',
        ENABLE_LISTENERS: 'true',
        ENABLE_ALERTS: 'true'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        DEMO_MODE: 'false',
        ENABLE_LISTENERS: 'true',
        ENABLE_ALERTS: 'false'
      },
      
      // Logging Configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Process Management
      autorestart: true,
      watch: false, // Disable in production
      max_memory_restart: '1G',
      restart_delay: 4000,
      
      // Health Monitoring
      min_uptime: '10s',
      max_restarts: 10,
      
      // Advanced Configuration
      node_args: '--max-old-space-size=2048',
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Environment Variables Override
      env_file: '.env'
    },
    
    // Metrics Collection Service (Optional)
    {
      name: 'bridge-monitor-metrics',
      script: 'scripts/metrics-collector.js',
      instances: 1,
      exec_mode: 'fork',
      
      env: {
        NODE_ENV: 'development',
        METRICS_PORT: 9090
      },
      env_production: {
        NODE_ENV: 'production',
        METRICS_PORT: 9090,
        METRICS_INTERVAL: 30000
      },
      
      // Logging
      log_file: './logs/metrics.log',
      out_file: './logs/metrics-out.log',
      error_file: './logs/metrics-error.log',
      time: true,
      
      // Process Management
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      
      // Only start in production
      env_production: {
        ...module.exports.apps[0].env_production,
        METRICS_ENABLED: 'true'
      }
    }
  ],

  // Deployment Configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-production-server.com'],
      ref: 'origin/main',
      repo: 'https://github.com/Subaskar-S/cross-chain-bridge-monitoring.git',
      path: '/var/www/bridge-monitor',
      
      // Pre-deployment commands
      'pre-deploy-local': '',
      
      // Post-receive hooks
      'post-deploy': [
        'npm install',
        'cd dashboard && npm install && npm run build && cd ..',
        'pm2 reload ecosystem.config.js --env production',
        'pm2 save'
      ].join(' && '),
      
      // Pre-setup
      'pre-setup': '',
      
      // Post-setup
      'post-setup': [
        'ls -la',
        'npm install',
        'cd dashboard && npm install && npm run build && cd ..',
        'pm2 start ecosystem.config.js --env production',
        'pm2 save',
        'pm2 startup'
      ].join(' && ')
    },
    
    staging: {
      user: 'deploy',
      host: ['your-staging-server.com'],
      ref: 'origin/develop',
      repo: 'https://github.com/Subaskar-S/cross-chain-bridge-monitoring.git',
      path: '/var/www/bridge-monitor-staging',
      
      'post-deploy': [
        'npm install',
        'cd dashboard && npm install && npm run build && cd ..',
        'pm2 reload ecosystem.config.js --env staging',
        'pm2 save'
      ].join(' && ')
    }
  }
};

// Additional PM2 Configuration Options
const advancedConfig = {
  // Cluster Configuration
  cluster: {
    instances: 'max',
    exec_mode: 'cluster',
    
    // Load Balancing
    instance_var: 'INSTANCE_ID',
    
    // Graceful Shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Health Checks
    health_check_grace_period: 3000
  },
  
  // Monitoring Configuration
  monitoring: {
    // PM2 Plus Integration
    pmx: true,
    
    // Custom Metrics
    custom_metrics: {
      'Active Connections': () => global.activeConnections || 0,
      'Database Status': () => global.dbStatus || 'unknown',
      'RPC Health': () => global.rpcHealth || 'unknown'
    },
    
    // Alerts
    alerts: {
      cpu: 80,
      memory: 80,
      exceptions: true
    }
  },
  
  // Log Management
  logs: {
    // Log Rotation
    log_type: 'json',
    merge_logs: true,
    
    // Log Levels
    log_level: {
      development: 'debug',
      staging: 'info',
      production: 'warn'
    }
  }
};

// Export advanced configuration if needed
module.exports.advanced = advancedConfig;
