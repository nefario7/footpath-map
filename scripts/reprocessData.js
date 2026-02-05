const TwitterService = require('../src/twitterService');
const fs = require('fs');
const path = require('path');

/**
 * Reprocess existing tweet data with updated parsing logic
 * No Twitter API calls - just re-parses what we already have in posts.json
 */
function reprocessExistingData() {
  const dataPath = path.join(__dirname, '../data/posts.json');
  
  // Check if data file exists
  if (!fs.existsSync(dataPath)) {
    console.error('❌ No data file found at data/posts.json');
    console.log('Run "npm run fetch" first to download tweets');
    process.exit(1);
  }
  
  // Read existing data
  console.log('📂 Reading existing data...');
  const existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  // Reconstruct all tweets from both arrays (they have all the original data)
  const allTweets = [
    ...existingData.posts.withCoords,
    ...existingData.posts.missingCoords
  ];
  
  console.log(`📊 Found ${allTweets.length} total tweets to reprocess`);
  console.log(`   Previous: ${existingData.postsWithCoords} with coords, ${existingData.postsMissingCoords} without`);
  
  // Reprocess with new parsing logic
  console.log('🔄 Re-parsing coordinates...');
  const twitterService = new TwitterService();
  const withCoords = [];
  const missingCoords = [];
  
  for (const tweet of allTweets) {
    const coords = twitterService.parseCoordinates(tweet.text);
    
    const processedTweet = {
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.createdAt,
      url: tweet.url || `https://twitter.com/caleb_friesen/status/${tweet.id}`,
      mediaUrls: tweet.mediaUrls || []
    };
    
    if (coords) {
      withCoords.push({
        ...processedTweet,
        coordinates: coords
      });
    } else {
      missingCoords.push(processedTweet);
    }
  }
  
  console.log(`\n✅ Reprocessing complete!`);
  console.log(`   New: ${withCoords.length} with coords, ${missingCoords.length} without`);
  
  if (withCoords.length > existingData.postsWithCoords) {
    console.log(`   🎉 Found ${withCoords.length - existingData.postsWithCoords} additional tweets with coordinates!`);
  } else if (withCoords.length === existingData.postsWithCoords) {
    console.log(`   ℹ️  No additional coordinates found with new patterns`);
  }
  
  // Save updated data
  const updatedData = {
    lastUpdated: new Date().toISOString(),
    totalPosts: allTweets.length,
    postsWithCoords: withCoords.length,
    postsMissingCoords: missingCoords.length,
    posts: { withCoords, missingCoords }
  };
  
  fs.writeFileSync(dataPath, JSON.stringify(updatedData, null, 2));
  console.log(`\n💾 Data saved to ${dataPath}`);
  
  // Show some examples of found coordinates
  if (withCoords.length > 0) {
    console.log(`\n📍 Sample coordinates:`);
    withCoords.slice(0, 3).forEach((tweet, i) => {
      console.log(`\n${i + 1}. Tweet ID: ${tweet.id}`);
      console.log(`   Coords: ${tweet.coordinates.lat}, ${tweet.coordinates.lon}`);
      console.log(`   Text: ${tweet.text.substring(0, 80)}...`);
    });
  }
}

// Run the script
try {
  reprocessExistingData();
} catch (error) {
  console.error('❌ Error reprocessing data:', error.message);
  process.exit(1);
}
