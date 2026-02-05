const TwitterService = require('../src/twitterService');
const fs = require('fs');
const path = require('path');

async function fetchAndSaveTweets() {
  try {
    console.log('Starting tweet fetch from Twitter API...');
    
    const twitterService = new TwitterService();
    
    // Fetch tweets
    const tweetsData = await twitterService.fetchRecentTweets();
    
    // Process tweets
    const processedData = twitterService.processTweets(tweetsData);
    
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Save to posts.json
    const dataPath = path.join(dataDir, 'posts.json');
    const dataToSave = {
      lastUpdated: new Date().toISOString(),
      totalPosts: processedData.withCoords.length + processedData.missingCoords.length,
      postsWithCoords: processedData.withCoords.length,
      postsMissingCoords: processedData.missingCoords.length,
      posts: processedData
    };
    
    fs.writeFileSync(dataPath, JSON.stringify(dataToSave, null, 2));
    
    console.log('✅ Data saved successfully to data/posts.json');
    console.log(`📊 Total: ${dataToSave.totalPosts} posts`);
    console.log(`📍 With coordinates: ${dataToSave.postsWithCoords}`);
    console.log(`⚠️  Missing coordinates: ${dataToSave.postsMissingCoords}`);
    
  } catch (error) {
    console.error('❌ Error fetching tweets:', error.message);
    process.exit(1);
  }
}

// Run the script
fetchAndSaveTweets();
