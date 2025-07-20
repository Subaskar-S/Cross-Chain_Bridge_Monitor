# Deploy to Vercel

## Quick Setup

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

## Environment Variables

Set these in Vercel dashboard:

- `MONGODB_URI` - Your MongoDB connection string
- `ETHEREUM_RPC` - Ethereum RPC URL
- `POLYGON_RPC` - Polygon RPC URL  
- `BSC_RPC` - BSC RPC URL
- `API_KEYS` - Your API keys
- `JWT_SECRET` - JWT secret key

## Demo Mode

For demo purposes, you can use:
- MongoDB Atlas free tier
- Public RPC endpoints
- Demo contract addresses

Your app will be live at: `https://your-project.vercel.app`
