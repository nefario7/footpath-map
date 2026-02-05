const db = require('../src/db');
const AiAnalysisService = require('../src/aiAnalysisService');
const GeocodingService = require('../src/geocodingService');

async function backfillAi() {
    try {
        await db.initDB();
        const client = await db.pool.connect();
        const aiService = new AiAnalysisService();
        const geocoder = new GeocodingService();

        if (!aiService.enabled) {
            console.error('❌ AI Service disabled. Check GEMINI_API_KEY.');
            process.exit(1);
        }

        console.log('🔍 Fetching unmapped posts from database...');

        // Get posts that are NOT in the locations table
        const res = await client.query(`
      SELECT p.* 
      FROM posts p
      LEFT JOIN locations l ON p.id = l.post_id
      WHERE l.id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 50 
    `);

        // LIMIT 50 to avoid hitting rate limits too hard in one go. 
        // User can run script multiple times.

        const postsToProcess = res.rows;
        console.log(`📋 Found ${postsToProcess.length} unmapped posts to process.`);

        if (postsToProcess.length === 0) {
            console.log('✅ No unmapped posts found.');
            process.exit(0);
        }

        let processedCount = 0;
        let mappedCount = 0;

        for (const post of postsToProcess) {
            processedCount++;
            console.log(`\n[${processedCount}/${postsToProcess.length}] Processing: ${post.id}`);
            // console.log(`   "${post.text.substring(0, 50)}..."`);

            try {
                const analysis = await aiService.analyzeTweet(post.text);

                if (analysis.isIssue && analysis.location) {
                    console.log(`   🤖 AI identified location: "${analysis.location}"`);

                    const coords = await geocoder.geocode(analysis.location);

                    if (coords) {
                        console.log(`   📍 Geocoded: ${coords.lat}, ${coords.lon}`);

                        // Insert into locations table
                        await client.query(`
              INSERT INTO locations (post_id, coordinates, extracted_location, status, updated_at)
              VALUES ($1, $2, $3, $4, NOW())
              ON CONFLICT (post_id) DO NOTHING
            `, [post.id, JSON.stringify(coords), analysis.location, 'ai_verified']);

                        mappedCount++;
                        console.log('   ✅ Saved to database!');
                    } else {
                        console.log('   Warning: Geocoding failed.');
                    }
                } else {
                    console.log('   ℹ️  No specific location found / Not an issue.');
                }

            } catch (err) {
                console.error(`   ❌ Error processing tweet ${post.id}:`, err.message);
            }
        }

        console.log(`\n✨ Backfill complete! Processed ${processedCount} posts. Mapped ${mappedCount} new locations.`);

    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

backfillAi();
