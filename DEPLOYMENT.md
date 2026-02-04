# Deployment Guide

## Backend Deployment (Render.com)

1. **Create a Render account** at https://render.com

2. **Create a new Web Service**:
   - Connect your GitHub repository
   - Choose "Web Service"
   - Configure:
     - **Name**: footpath-map-api
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free

3. **Add Environment Variables** in Render dashboard:
   ```
   TWITTER_BEARER_TOKEN=your_actual_bearer_token
   NODE_ENV=production
   FRONTEND_URL=https://your-netlify-url.netlify.app
   ```

4. **Note your Render URL** (e.g., `https://footpath-map-api.onrender.com`)

## Frontend Deployment (Netlify)

1. **Create a Netlify account** at https://netlify.com

2. **Deploy from GitHub**:
   - Connect your repository
   - Configure:
     - **Build Command**: (leave empty or `echo 'No build needed'`)
     - **Publish Directory**: `public`

3. **Update API URL in netlify.toml**:
   - Edit the `/api/*` redirect to point to your Render backend URL
   - Replace `https://your-render-backend-url.onrender.com` with your actual URL

4. **Deploy** - Netlify will automatically deploy

5. **Update backend CORS**:
   - Go back to Render dashboard
   - Update `FRONTEND_URL` environment variable with your Netlify URL
   - Redeploy the backend

## Alternative: All-in-One Render Deployment

If you prefer to host everything on Render:

1. Deploy as a Web Service on Render (same as above)
2. The backend serves static files from `/public` directory
3. Access at: `https://your-app.onrender.com`
4. No need for Netlify

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

3. Add your Twitter Bearer Token to `.env`

4. Run locally:
   ```bash
   npm start
   ```

5. Visit `http://localhost:3000`

## Initial Data Fetch

After deployment, trigger initial data fetch:
- Visit `http://your-backend-url/api/refresh` (POST request)
- Or use the "Refresh Data" button in the web UI

## Monitoring

- Check Render logs for backend errors
- Cron job runs every 2 days at 2 AM
- Monitor Twitter API rate limits in logs
