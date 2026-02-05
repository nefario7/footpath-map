const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const TwitterService = require('./twitterService');
const IssueProcessor = require('./issueProcessor'); // New Service
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*'
}));
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use(express.static('public')); // Fallback for old assets if any


/**
 * Job 1: Ingestion (Fetch Tweets -> DB)
 */
async function runIngestion() {
  try {
    console.log('📥 Starting Ingestion Job...');
    await db.initDB();
    const twitterService = new TwitterService();

    // Get latest ID to fetch only new tweets
    const sinceId = await db.getLatestTweetId();
    console.log(`   Latest tweet ID: ${sinceId || 'None'}`);

    const tweetsData = await twitterService.fetchRecentTweets(sinceId);

    if (tweetsData.tweets.length === 0) {
      console.log('   No new tweets found.');
      return;
    }

    const processedData = await twitterService.processTweets(tweetsData);
    const savedCount = await db.savePosts(processedData);

    console.log(`✅ Ingestion Complete: Saved ${savedCount} posts.`);
  } catch (error) {
    console.error('❌ Ingestion Error:', error.message);
  }
}

/**
 * Job 2: Processing (Pending Tweets -> AI -> Map)
 * Using a global instance to track state across calls
 */
const issueProcessor = new IssueProcessor();

async function runProcessing() {
  try {
    return await issueProcessor.processQueue();
  } catch (error) {
    console.error('❌ Processing Error:', error.message);
    return { error: error.message };
  }
}

// API Routes

/**
 * GET /api/locations
 * Returns all posts with coordinates for map display
 */
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await db.getLocations();
    res.json({
      lastUpdated: new Date(),
      count: locations.length,
      locations: locations
    });
  } catch (error) {
    console.error('Error reading locations:', error);
    res.status(500).json({ error: 'Failed to read locations data' });
  }
});

/**
 * GET /api/posts
 * Returns all posts
 */
app.get('/api/posts', async (req, res) => {
  try {
    const data = await db.getAllPosts();
    res.json({
      lastUpdated: new Date(),
      ...data
    });
  } catch (error) {
    console.error('Error reading posts:', error);
    res.status(500).json({ error: 'Failed to read posts data' });
  }
});

/**
 * POST /api/refresh (Ingestion Trigger)
 */
app.post('/api/refresh', async (req, res) => {
  try {
    await runIngestion();
    // Optionally trigger processing immediately after ingestion
    runProcessing();

    res.json({ success: true, message: 'Ingestion triggered' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/process (Processing Trigger)
 */
app.post('/api/process', async (req, res) => {
  try {
    await runProcessing();
    res.json({ success: true, message: 'Processing triggered' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/status
 * Returns overall system status including processing progress
 */
app.get('/api/status', async (req, res) => {
  try {
    const data = await db.getAllPosts();
    const processingStats = await db.getProcessingStats();
    const processorStatus = issueProcessor.getStatus();

    res.json({
      status: 'online',
      lastUpdated: new Date(),
      totalPosts: data.totalPosts,
      postsWithCoords: data.postsWithCoords,
      postsMissingCoords: data.postsMissingCoords,
      processing: {
        ...processingStats,
        isProcessing: processorStatus.isProcessing,
        lastCycleTime: processorStatus.lastCycleTime,
        aiQuotaExhausted: processorStatus.aiStatus.quotaExhausted,
        aiQuotaResetMinutes: processorStatus.aiStatus.minutesUntilReset
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// --- Schedulers ---

// 1. Ingestion: Every 2 days at 2 AM
cron.schedule('0 2 */2 * *', async () => {
  await runIngestion();
});

// 2. Continuous Processing Loop
// Processes pending tweets automatically with delays between batches
let processingLoopRunning = false;

async function startContinuousProcessing() {
  if (processingLoopRunning) return;
  processingLoopRunning = true;

  console.log('🔄 Starting continuous processing loop...');

  while (processingLoopRunning) {
    const result = await runProcessing();

    // If quota exhausted, wait until reset
    if (result?.skipped && result?.reason === 'quota_exhausted') {
      const waitMs = Math.max((result.minutesUntilReset || 60) * 60 * 1000, 60000);
      console.log(`⏸️  Pausing processing for ${Math.round(waitMs / 60000)} minutes due to quota...`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }

    // If nothing to process, check again in 5 minutes
    if (result?.reason === 'no_pending') {
      console.log('✅ All caught up! Checking again in 5 minutes...');
      await new Promise(r => setTimeout(r, 5 * 60 * 1000));
      continue;
    }

    // Normal processing - wait 10 seconds between batches to be nice to APIs
    await new Promise(r => setTimeout(r, 10000));
  }
}

function stopProcessingLoop() {
  processingLoopRunning = false;
}


// The "catchall" handler
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start server
const startServer = async () => {
  try {
    await db.initDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

    // Start continuous processing after server is up
    setTimeout(() => {
      startContinuousProcessing();
    }, 3000);

  } catch (error) {
    console.error('Fatal error starting server:', error);
  }
};

startServer();
