# 🚀 Deployment Guide

This guide covers deploying the Cross-Chain Bridge Monitoring System to various free hosting platforms.

## 📋 Prerequisites

- GitHub repository with your code
- Built React dashboard (`npm run build:dashboard`)
- Environment variables configured

## 🌐 Platform Options

### 1. **Render.com** (Recommended) ⭐

**Why Render?**
- ✅ Free tier with 750 hours/month
- ✅ Automatic deployments from GitHub
- ✅ Built-in PostgreSQL database
- ✅ Custom domains
- ✅ SSL certificates

**Steps:**
1. Push your code to GitHub
2. Go to [render.com](https://render.com) and sign up
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: `bridge-monitor`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

**Environment Variables:**
```
NODE_ENV=production
DEMO_MODE=true
PORT=10000
```

**Live Demo**: Your app will be available at `https://bridge-monitor.onrender.com`

### 2. **Railway.app**

**Why Railway?**
- ✅ $5 free credit monthly
- ✅ Simple deployment
- ✅ Built-in databases
- ✅ Great for Node.js apps

**Steps:**
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Deploy: `railway up`
4. Set environment variables in Railway dashboard

### 3. **Vercel** (Frontend Focus)

**Why Vercel?**
- ✅ Excellent for React apps
- ✅ Serverless functions
- ✅ Fast global CDN
- ✅ Free tier

**Steps:**
1. Install Vercel CLI: `npm install -g vercel`
2. Run: `vercel`
3. Follow the prompts
4. Your app will be deployed automatically

### 4. **Heroku** (Classic)

**Why Heroku?**
- ✅ Well-established platform
- ✅ Free tier (with limitations)
- ✅ Add-ons ecosystem

**Steps:**
1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create bridge-monitor`
4. Deploy: `git push heroku main`

## 🔧 Configuration

### Environment Variables

Set these environment variables in your hosting platform:

```bash
# Required
NODE_ENV=production
DEMO_MODE=true
PORT=10000

# Optional (for full functionality)
MONGODB_URI=your_mongodb_connection_string
ETHEREUM_RPC_URL=https://eth.llamarpc.com
POLYGON_RPC_URL=https://polygon.llamarpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org/

# Demo contract addresses
ETHEREUM_BRIDGE_CONTRACT=0x1234567890123456789012345678901234567890
POLYGON_BRIDGE_CONTRACT=0x1234567890123456789012345678901234567890
BSC_BRIDGE_CONTRACT=0x1234567890123456789012345678901234567890
```

### Build Commands

Most platforms will automatically detect and run:
```bash
npm install && npm run build
```

### Start Commands

The application starts with:
```bash
npm start
```

## 📊 Demo Features

The deployed demo includes:

### 🎭 **Mock Data**
- 50+ sample transactions across 3 networks
- 20+ sample anomalies with different severity levels
- 30+ sample alerts with various statuses
- Real-time volume trends (simulated)

### 🔌 **API Endpoints**
- `GET /api/health` - Health check
- `GET /api/transactions` - Transaction list
- `GET /api/anomalies` - Anomaly list
- `GET /api/alerts` - Alert list
- `GET /api/volume/dashboard` - Dashboard statistics
- `GET /api/volume/trends` - Volume trends

### 🌐 **Dashboard Features**
- Interactive charts and graphs
- Real-time statistics
- Network status monitoring
- Transaction filtering
- Responsive design

## 🚀 Quick Deploy Commands

### Render.com
```bash
# 1. Push to GitHub
git add .
git commit -m "Deploy to Render"
git push origin main

# 2. Connect repository in Render dashboard
# 3. Deploy automatically
```

### Railway
```bash
# 1. Install CLI
npm install -g @railway/cli

# 2. Login and deploy
railway login
railway up
```

### Vercel
```bash
# 1. Install CLI
npm install -g vercel

# 2. Deploy
vercel --prod
```

## 🔍 Testing Your Deployment

After deployment, test these endpoints:

1. **Health Check**: `https://your-app.com/api/health`
2. **Dashboard**: `https://your-app.com/`
3. **API**: `https://your-app.com/api/transactions`

Expected responses:
```json
// Health check
{
  "status": "OK",
  "uptime": 123.45,
  "mode": "demo"
}

// Transactions
{
  "success": true,
  "data": [...],
  "pagination": {...}
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Build Fails**
   - Check Node.js version (use 18.x)
   - Ensure all dependencies are in package.json
   - Check build logs for specific errors

2. **App Won't Start**
   - Verify PORT environment variable
   - Check start command in package.json
   - Review application logs

3. **Dashboard Not Loading**
   - Ensure dashboard was built: `npm run build:dashboard`
   - Check static file serving in server
   - Verify build directory exists

4. **API Errors**
   - Check environment variables
   - Verify DEMO_MODE is set to "true"
   - Review server logs

### Debug Commands

```bash
# Check build
npm run build:dashboard

# Test locally
npm start

# Check health
curl https://your-app.com/api/health
```

## 📈 Performance Tips

1. **Enable Gzip Compression**
2. **Use CDN for Static Assets**
3. **Implement Caching Headers**
4. **Monitor Response Times**
5. **Set Up Health Checks**

## 🔒 Security Considerations

1. **Environment Variables**: Never commit secrets
2. **HTTPS**: Always use SSL in production
3. **CORS**: Configure properly for your domain
4. **Rate Limiting**: Implement API rate limiting
5. **Input Validation**: Validate all inputs

## 📞 Support

If you encounter issues:

1. Check the deployment logs
2. Review this guide
3. Test locally first
4. Check platform-specific documentation
5. Open an issue on GitHub

---

**🎉 Congratulations!** Your Cross-Chain Bridge Monitoring System is now live and accessible to the world!
